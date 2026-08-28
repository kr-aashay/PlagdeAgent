// ═══════════════════════════════════════════════════════════════════════════
// Admin Dashboard JavaScript with Auth & Member Control
// ═══════════════════════════════════════════════════════════════════════════

console.log('Admin JavaScript loaded');

// Global variables
let autoRefreshInterval = null;
let autoRefreshEnabled = false;
let currentMemberPage = 1;
let currentSearchTerm = '';
let searchDebounceTimer = null;
let activeConfirmCallback = null;

// Initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function initApp() {
    console.log('Initializing admin app...');
    setupKeyboardShortcuts();
    checkAuthAndInit();
}

/* ─── Authentication Helpers ────────────────────────────────────────────────── */

function getAdminToken() {
    return sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token') || '';
}

function setAdminToken(token) {
    sessionStorage.setItem('admin_token', token);
    localStorage.setItem('admin_token', token);
}

function clearAdminToken() {
    sessionStorage.removeItem('admin_token');
    localStorage.removeItem('admin_token');
}

async function authenticatedFetch(url, options = {}) {
    const token = getAdminToken();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-admin-key': token,
        ...(options.headers || {})
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        console.warn('Session expired or unauthorized.');
        clearAdminToken();
        showLoginModal();
        throw new Error('Admin session expired. Please log in again.');
    }

    return response;
}

async function checkAuthAndInit() {
    const token = getAdminToken();
    if (!token) {
        showLoginModal();
        return;
    }

    try {
        const res = await fetch('/APO/admin/verify', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-admin-key': token
            }
        });

        if (res.ok) {
            hideLoginModal();
            mountDashboard();
            loadDashboardData();
            loadMembers(1);
        } else {
            clearAdminToken();
            showLoginModal();
        }
    } catch (err) {
        console.warn('Auth verify failed:', err.message);
        showLoginModal();
    }
}

function showLoginModal() {
    const modal = document.getElementById('loginModal');
    const root = document.getElementById('adminRoot');
    if (modal) modal.style.display = 'flex';
    if (root) root.innerHTML = ''; // Wipe dashboard completely from DOM

    const pwdInput = document.getElementById('adminPasswordInput');
    if (pwdInput) {
        pwdInput.value = '';
        setTimeout(() => pwdInput.focus(), 100);
    }
}

function hideLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'none';
}

function togglePasswordVisibility() {
    const input = document.getElementById('adminPasswordInput');
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
}

async function handleLoginSubmit(event) {
    if (event) event.preventDefault();

    const pwdInput = document.getElementById('adminPasswordInput');
    const errorBox = document.getElementById('loginErrorMsg');
    const loginBtn = document.getElementById('loginBtn');
    const password = pwdInput ? pwdInput.value.trim() : '';

    if (!password) {
        if (errorBox) {
            errorBox.textContent = 'Please enter the admin password.';
            errorBox.style.display = 'block';
        }
        return;
    }

    try {
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span>⏳ Authenticating...</span>';
        }
        if (errorBox) errorBox.style.display = 'none';

        const res = await fetch('/APO/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const rawText = await res.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (jsonErr) {
            throw new Error(`Server returned HTTP ${res.status} (${res.statusText || 'HTML error'}). Node server might still be restarting.`);
        }

        if (!res.ok || !data.ok) {
            throw new Error(data.error || 'Invalid admin password.');
        }

        // Save token, hide login, and mount dynamic dashboard
        setAdminToken(data.token);
        hideLoginModal();
        mountDashboard();
        showNotification('Signed in as Admin', 'success');

        loadDashboardData();
        loadMembers(1);

    } catch (err) {
        console.error('Login failed:', err);
        if (errorBox) {
            errorBox.textContent = err.message || 'Login failed. Please check your password.';
            errorBox.style.display = 'block';
        }
    } finally {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<span>🔓 Sign In to Dashboard</span>';
        }
    }
}

function logoutAdmin() {
    clearAdminToken();
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        autoRefreshEnabled = false;
    }
    showLoginModal();
    showNotification('Logged out successfully', 'info');
}

/* ─── Dynamic Dashboard Mounting ────────────────────────────────────────────── */

function mountDashboard() {
    const root = document.getElementById('adminRoot');
    if (!root) return;

    root.innerHTML = `
    <div class="admin-container" id="adminApp">
        <header class="admin-header">
            <div class="header-left">
                <div class="header-badge">ADMIN CONSOLE</div>
                <h1>🔐 AI Ethics Pledge Dashboard</h1>
                <div class="last-updated">
                    Last updated: <span id="lastUpdated">Loading...</span>
                </div>
            </div>
            <div class="header-actions">
                <span class="auth-status-pill">
                    <span class="pulse-dot"></span> Admin Authenticated
                </span>
                <button class="logout-btn" onclick="logoutAdmin()" title="Log out of admin session">
                    🚪 Logout
                </button>
            </div>
        </header>

        <!-- Stats Overview Cards -->
        <div class="stats-grid">
            <div class="stat-card registered">
                <div class="stat-icon">✅</div>
                <div class="stat-content">
                    <div class="stat-label">Oath Taken</div>
                    <div class="stat-value" id="registeredCount">-</div>
                </div>
            </div>

            <div class="stat-card unregistered">
                <div class="stat-icon">⏳</div>
                <div class="stat-content">
                    <div class="stat-label">Pending Oath</div>
                    <div class="stat-value" id="unregisteredCount">-</div>
                </div>
            </div>

            <div class="stat-card total">
                <div class="stat-icon">👥</div>
                <div class="stat-content">
                    <div class="stat-label">Total On-Roll</div>
                    <div class="stat-value" id="totalCount">-</div>
                </div>
            </div>

            <div class="stat-card completion">
                <div class="stat-icon">📊</div>
                <div class="stat-content">
                    <div class="stat-label">Completion Rate</div>
                    <div class="stat-value" id="completionRate">-</div>
                </div>
            </div>
        </div>

        <!-- Breakdown Section -->
        <div class="breakdown-section">
            <h2>Registration Breakdown</h2>
            <div class="breakdown-grid">
                <div class="breakdown-card">
                    <h3>👨‍🎓 Students</h3>
                    <div class="breakdown-stats">
                        <div class="breakdown-item">
                            <span class="breakdown-label">Completed:</span>
                            <span class="breakdown-value" id="studentsRegistered">-</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="breakdown-label">Pending:</span>
                            <span class="breakdown-value" id="studentsUnregistered">-</span>
                        </div>
                    </div>
                </div>

                <div class="breakdown-card">
                    <h3>👨‍💼 Employees</h3>
                    <div class="breakdown-stats">
                        <div class="breakdown-item">
                            <span class="breakdown-label">Completed:</span>
                            <span class="breakdown-value" id="employeesRegistered">-</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="breakdown-label">Pending:</span>
                            <span class="breakdown-value" id="employeesUnregistered">-</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Export Reports -->
        <div class="actions-section">
            <h2>📥 Export Reports</h2>
            <div class="actions-grid">
                <button class="export-btn registered-btn" onclick="downloadRegistered()">
                    <span class="btn-icon">📑</span>
                    <span class="btn-text">
                        <strong>Download Registered List</strong>
                        <small>Excel sheet with all participants who completed the pledge</small>
                    </span>
                </button>

                <button class="export-btn unregistered-btn" onclick="downloadUnregistered()">
                    <span class="btn-icon">📋</span>
                    <span class="btn-text">
                        <strong>Download Unregistered List</strong>
                        <small>Excel sheet with eligible participants yet to complete</small>
                    </span>
                </button>
            </div>
            
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                <small style="color: #718096;">
                    💡 <strong>Shortcuts:</strong> 
                    Ctrl+R (Refresh) • Ctrl+D (Download Registered) • Ctrl+U (Download Unregistered)
                </small>
            </div>
        </div>

        <!-- Member Management Section -->
        <div class="management-section">
            <div class="section-header-wrap">
                <div>
                    <h2>👥 Member Management & Oath Control</h2>
                    <p class="section-desc">Search any student or employee to <strong>reset their oath status (allow retake)</strong> or <strong>delete records</strong>.</p>
                </div>
                <button class="btn-secondary" onclick="loadMembers(1)">🔄 Refresh List</button>
            </div>

            <!-- Search & Filter Bar -->
            <div class="search-filter-bar">
                <div class="search-input-wrap">
                    <span class="search-icon">🔍</span>
                    <input 
                        type="text" 
                        id="memberSearchInput" 
                        placeholder="Search by Reg No, Employee ID, Name, Branch..." 
                        oninput="onSearchInput(event)"
                    />
                    <button id="clearSearchBtn" class="clear-search-btn" onclick="clearSearch()" style="display: none;">✕</button>
                </div>

                <div class="filter-controls">
                    <select id="memberTypeFilter" onchange="onFilterChange()">
                        <option value="all">All Types</option>
                        <option value="student">👨‍🎓 Students Only</option>
                        <option value="employee">👨‍💼 Employees Only</option>
                    </select>

                    <select id="memberStatusFilter" onchange="onFilterChange()">
                        <option value="all">All Oath Statuses</option>
                        <option value="completed">✅ Oath Completed</option>
                        <option value="pending">⏳ Pending / Not Taken</option>
                    </select>
                </div>
            </div>

            <!-- Members Data Table -->
            <div class="table-container">
                <table class="registrations-table management-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Identifier / Reg No</th>
                            <th>Name</th>
                            <th>Department / Branch</th>
                            <th>Oath Status</th>
                            <th>Downloads</th>
                            <th style="text-align: center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="membersTableBody">
                        <tr>
                            <td colspan="7" class="loading">Loading members data...</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination Bar -->
            <div class="pagination-bar" id="paginationBar" style="display: none;">
                <div class="pagination-info" id="paginationInfo">Showing 0-0 of 0</div>
                <div class="pagination-buttons">
                    <button id="prevPageBtn" class="btn-page" onclick="changePage(-1)">← Previous</button>
                    <span id="pageIndicator" class="page-indicator">Page 1 of 1</span>
                    <button id="nextPageBtn" class="btn-page" onclick="changePage(1)">Next →</button>
                </div>
            </div>
        </div>

        <!-- Dashboard Controls -->
        <div class="actions-section" style="margin-bottom: 25px;">
            <h2>⚙️ Dashboard Controls</h2>
            <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                <button class="refresh-now-btn" onclick="refreshNow()">
                    🔄 Refresh Dashboard
                </button>
                
                <button id="autoRefreshBtn" class="auto-refresh-btn" onclick="toggleAutoRefresh()">
                    🔄 Enable Auto-refresh
                </button>
            </div>
        </div>

        <!-- Recent Registrations (Last 10) -->
        <div class="recent-registrations">
            <h2>⏱️ Recent Pledge Completions (Last 10)</h2>
            <div class="table-container">
                <table class="registrations-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Department</th>
                            <th>Completed At</th>
                            <th>Status</th>
                            <th style="text-align: center;">Quick Action</th>
                        </tr>
                    </thead>
                    <tbody id="recentRegistrations">
                        <tr>
                            <td colspan="7" class="loading">Loading recent records...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `;
}

/* ─── Dashboard Stats Loading ───────────────────────────────────────────────── */

async function loadDashboardData() {
    console.log('Loading dashboard statistics...');

    try {
        const response = await authenticatedFetch('/APO/admin/stats?t=' + Date.now());
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.ok) {
            throw new Error(data.error || 'API returned error');
        }

        updateDashboardUI(data);
        updateLastUpdated();

    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        if (getAdminToken()) {
            showNotification(`Failed to load data: ${error.message}`, 'error');
            showErrorState();
        }
    }
}

function updateDashboardUI(data) {
    try {
        // Main stats
        updateElement('registeredCount', formatNumber(data.registered.total));
        updateElement('unregisteredCount', formatNumber(data.unregistered.total));
        updateElement('totalCount', formatNumber(data.total));

        // Completion rate
        const rate = data.total > 0 ? ((data.registered.total / data.total) * 100).toFixed(1) : '0.0';
        updateElement('completionRate', rate + '%');

        // Breakdown
        updateElement('studentsRegistered', formatNumber(data.registered.students));
        updateElement('studentsUnregistered', formatNumber(data.unregistered.students));
        updateElement('employeesRegistered', formatNumber(data.registered.employees));
        updateElement('employeesUnregistered', formatNumber(data.unregistered.employees));

        // Recent registrations
        updateRecentRegistrations(data.recentRegistrations || []);

        clearErrorState();

    } catch (error) {
        console.error('Error updating UI:', error);
    }
}

function updateRecentRegistrations(registrations) {
    const tbody = document.getElementById('recentRegistrations');
    if (!tbody) return;

    if (registrations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No pledge completions found</td></tr>';
        return;
    }

    tbody.innerHTML = registrations.map(reg => `
        <tr>
            <td>
                <span class="type-badge type-${reg.type}">
                    ${reg.type === 'student' ? '👨‍🎓 Student' : '👨‍💼 Employee'}
                </span>
            </td>
            <td><span class="id-badge">${escapeHtml(reg.identifier || reg.id)}</span></td>
            <td><strong>${escapeHtml(reg.name)}</strong></td>
            <td>${escapeHtml(reg.department || 'N/A')}</td>
            <td>${formatDateTime(reg.registered_at)}</td>
            <td>
                <span class="status-badge ${reg.oath_taken ? 'status-completed' : 'status-pending'}">
                    ${reg.oath_taken ? '✅ Completed' : '⏳ Pending'}
                </span>
            </td>
            <td style="text-align: center;">
                <div class="action-btn-group">
                    <button 
                        class="btn-action btn-retake" 
                        onclick="promptRetakeOath('${reg.type}', '${reg.id}', '${escapeJs(reg.name)}', '${escapeJs(reg.identifier || reg.id)}')"
                        title="Reset oath to allow taking again"
                    >
                        🔄 Retake
                    </button>
                    <button 
                        class="btn-action btn-delete" 
                        onclick="promptDeleteMember('${reg.type}', '${reg.id}', '${escapeJs(reg.name)}', '${escapeJs(reg.identifier || reg.id)}')"
                        title="Delete member from system"
                    >
                        🗑️ Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

/* ─── Member Management & Search ────────────────────────────────────────────── */

function onSearchInput(e) {
    const val = e.target.value;
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.style.display = val ? 'flex' : 'none';

    currentSearchTerm = val;
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        loadMembers(1);
    }, 300);
}

function clearSearch() {
    const input = document.getElementById('memberSearchInput');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.style.display = 'none';

    currentSearchTerm = '';
    loadMembers(1);
}

function onFilterChange() {
    loadMembers(1);
}

async function loadMembers(page = 1) {
    currentMemberPage = page;
    const tbody = document.getElementById('membersTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading members data...</td></tr>';
    }

    const typeFilter = document.getElementById('memberTypeFilter')?.value || 'all';
    const statusFilter = document.getElementById('memberStatusFilter')?.value || 'all';
    const search = currentSearchTerm.trim();

    try {
        const queryParams = new URLSearchParams({
            q: search,
            type: typeFilter,
            status: statusFilter,
            page: page,
            limit: 15,
            t: Date.now()
        });

        const res = await authenticatedFetch(`/APO/admin/members?${queryParams.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed to fetch members');

        renderMembersTable(data.members || []);
        renderPagination(data.pagination);

    } catch (err) {
        console.error('Failed to load members:', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="loading" style="color: #e53e3e;">Error: ${escapeHtml(err.message)}</td></tr>`;
        }
    }
}

function renderMembersTable(members) {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;

    if (members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No members found matching the criteria.</td></tr>';
        return;
    }

    tbody.innerHTML = members.map(m => {
        const isOathCompleted = m.oath_taken === true;
        const certDownloaded = m.certificate_downloaded === true;
        const badgeDownloaded = m.badge_downloaded === true;

        return `
            <tr>
                <td>
                    <span class="type-badge type-${m.type}">
                        ${m.type === 'student' ? '👨‍🎓 Student' : '👨‍💼 Employee'}
                    </span>
                </td>
                <td><span class="id-badge">${escapeHtml(m.identifier)}</span></td>
                <td>
                    <strong>${escapeHtml(m.name)}</strong>
                    ${m.archetype ? `<br><span class="archetype-tag">🎖️ ${escapeHtml(m.archetype)}</span>` : ''}
                </td>
                <td>
                    ${escapeHtml(m.department || 'N/A')}
                    ${m.branch_shortname ? `<small style="color:#64748b;"> (${escapeHtml(m.branch_shortname)})</small>` : ''}
                </td>
                <td>
                    <span class="status-badge ${isOathCompleted ? 'status-completed' : 'status-pending'}">
                        ${isOathCompleted ? '✅ Completed' : '⏳ Pending'}
                    </span>
                    ${m.pledge_taken_at ? `<br><small style="color:#64748b;font-size:11px;">${formatDateTime(m.pledge_taken_at)}</small>` : ''}
                </td>
                <td>
                    <div class="download-icons">
                        <span class="dl-pill ${certDownloaded ? 'dl-yes' : 'dl-no'}" title="Certificate: ${certDownloaded ? 'Downloaded' : 'Not yet'}">
                            📜 ${certDownloaded ? 'Yes' : 'No'}
                        </span>
                        <span class="dl-pill ${badgeDownloaded ? 'dl-yes' : 'dl-no'}" title="Badge: ${badgeDownloaded ? 'Downloaded' : 'Not yet'}">
                            🏅 ${badgeDownloaded ? 'Yes' : 'No'}
                        </span>
                    </div>
                </td>
                <td style="text-align: center;">
                    <div class="action-btn-group">
                        <button 
                            class="btn-action btn-retake" 
                            onclick="promptRetakeOath('${m.type}', '${m.id}', '${escapeJs(m.name)}', '${escapeJs(m.identifier)}')"
                            title="Reset oath so user can retake"
                        >
                            🔄 Retake
                        </button>
                        <button 
                            class="btn-action btn-delete" 
                            onclick="promptDeleteMember('${m.type}', '${m.id}', '${escapeJs(m.name)}', '${escapeJs(m.identifier)}')"
                            title="Delete this record"
                        >
                            🗑️ Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderPagination(pagination) {
    const bar = document.getElementById('paginationBar');
    const info = document.getElementById('paginationInfo');
    const indicator = document.getElementById('pageIndicator');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');

    if (!bar || !pagination || pagination.total === 0) {
        if (bar) bar.style.display = 'none';
        return;
    }

    bar.style.display = 'flex';
    const { page, limit, total, totalPages } = pagination;

    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    if (info) info.textContent = `Showing ${start}-${end} of ${total.toLocaleString()} members`;
    if (indicator) indicator.textContent = `Page ${page} of ${totalPages || 1}`;

    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextPageBtn) nextPageBtn.disabled = page >= totalPages;
}

function changePage(delta) {
    const newPage = currentMemberPage + delta;
    if (newPage >= 1) {
        loadMembers(newPage);
    }
}

/* ─── Member Actions (Retake Oath & Delete) ─────────────────────────────────── */

function promptRetakeOath(type, id, name, identifier) {
    showConfirmModal({
        icon: '🔄',
        title: 'Allow Oath Retake?',
        message: `Resetting the oath will allow <strong>${escapeHtml(name)}</strong> (${escapeHtml(identifier)}) to retake the AI Ethics Pledge assessment from the start.`,
        details: `Type: ${type.toUpperCase()} | ID: ${identifier}`,
        confirmText: 'Yes, Allow Retake',
        confirmClass: 'confirm-warning',
        onConfirm: async () => {
            await executeResetOath(type, id, name, identifier);
        }
    });
}

async function executeResetOath(type, id, name, identifier) {
    try {
        const res = await authenticatedFetch('/APO/admin/members/retake', {
            method: 'POST',
            body: JSON.stringify({ type, id, identifier })
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
            throw new Error(data.error || 'Failed to reset oath.');
        }

        showNotification(data.message || `Oath reset for ${name}. They can now retake the assessment.`, 'success');
        closeConfirmModal();

        // Refresh stats and current member list
        loadDashboardData();
        loadMembers(currentMemberPage);

    } catch (err) {
        console.error('Reset oath failed:', err);
        showNotification(`Failed to reset oath: ${err.message}`, 'error');
    }
}

function promptDeleteMember(type, id, name, identifier) {
    showConfirmModal({
        icon: '🗑️',
        title: 'Delete Member Record?',
        message: `Are you sure you want to permanently delete <strong>${escapeHtml(name)}</strong> (${escapeHtml(identifier)}) from the database? This action cannot be undone.`,
        details: `Type: ${type.toUpperCase()} | ID: ${identifier}`,
        confirmText: 'Yes, Permanently Delete',
        confirmClass: 'confirm-danger',
        onConfirm: async () => {
            await executeDeleteMember(type, id, name, identifier);
        }
    });
}

async function executeDeleteMember(type, id, name, identifier) {
    try {
        const res = await authenticatedFetch(`/APO/admin/members/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
            throw new Error(data.error || 'Failed to delete member.');
        }

        showNotification(data.message || `Member ${name} (${identifier}) deleted successfully.`, 'success');
        closeConfirmModal();

        // Refresh stats and member list
        loadDashboardData();
        loadMembers(currentMemberPage);

    } catch (err) {
        console.error('Delete failed:', err);
        showNotification(`Failed to delete member: ${err.message}`, 'error');
    }
}

/* ─── Confirmation Modal Helper ─────────────────────────────────────────────── */

function showConfirmModal(opts) {
    const modal = document.getElementById('confirmModal');
    if (!modal) return;

    document.getElementById('confirmIcon').textContent = opts.icon || '⚠️';
    document.getElementById('confirmTitle').textContent = opts.title || 'Confirm Action';
    document.getElementById('confirmMessage').innerHTML = opts.message || 'Are you sure?';
    document.getElementById('confirmDetails').innerHTML = opts.details || '';

    const confirmBtn = document.getElementById('confirmExecuteBtn');
    confirmBtn.textContent = opts.confirmText || 'Confirm';
    confirmBtn.className = `btn-confirm ${opts.confirmClass || ''}`;

    activeConfirmCallback = opts.onConfirm;
    confirmBtn.onclick = () => {
        if (typeof activeConfirmCallback === 'function') {
            activeConfirmCallback();
        }
    };

    modal.style.display = 'flex';
}

function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.style.display = 'none';
    activeConfirmCallback = null;
}

/* ─── Report Downloads ──────────────────────────────────────────────────────── */

async function downloadRegistered() {
    await downloadFile('/APO/admin/export/registered', 'registered_participants');
}

async function downloadUnregistered() {
    await downloadFile('/APO/admin/export/unregistered', 'unregistered_participants');
}

async function downloadFile(url, filename) {
    const btn = event?.target?.closest('button');
    const originalHTML = btn?.innerHTML;

    try {
        if (btn) {
            btn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text"><strong>Downloading...</strong><small>Generating Excel file</small></span>';
            btn.disabled = true;
        }

        const token = getAdminToken();
        const sep = url.includes('?') ? '&' : '?';
        const fullUrl = `${url}${sep}token=${encodeURIComponent(token)}&t=${Date.now()}`;

        const response = await authenticatedFetch(fullUrl);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        if (blob.size === 0) {
            throw new Error('Downloaded file is empty');
        }

        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${filename}_${getTimestamp()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);

        showNotification('Report downloaded successfully', 'success');

    } catch (error) {
        console.error('Download failed:', error);
        showNotification(`Download failed: ${error.message}`, 'error');
    } finally {
        if (btn) {
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }, 1000);
        }
    }
}

/* ─── Dashboard Controls ────────────────────────────────────────────────────── */

function refreshNow() {
    const btn = event?.target;
    const originalText = btn?.textContent;

    if (btn) {
        btn.textContent = '🔄 Refreshing...';
        btn.disabled = true;
    }

    Promise.all([
        loadDashboardData(),
        loadMembers(currentMemberPage)
    ]).finally(() => {
        if (btn) {
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 1000);
        }
    });

    showNotification('Dashboard refreshed', 'success');
}

function toggleAutoRefresh() {
    const btn = document.getElementById('autoRefreshBtn');

    if (autoRefreshEnabled) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        autoRefreshEnabled = false;
        if (btn) {
            btn.textContent = '🔄 Enable Auto-refresh';
            btn.classList.remove('auto-refresh-active');
        }
        showNotification('Auto-refresh disabled', 'info');
    } else {
        autoRefreshInterval = setInterval(() => {
            loadDashboardData();
            loadMembers(currentMemberPage);
        }, 30000);
        autoRefreshEnabled = true;
        if (btn) {
            btn.textContent = '⏸️ Disable Auto-refresh';
            btn.classList.add('auto-refresh-active');
        }
        showNotification('Auto-refresh enabled (every 30s)', 'success');
    }
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeConfirmModal();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            refreshNow();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            downloadRegistered();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
            e.preventDefault();
            downloadUnregistered();
        }
    });
}

/* ─── Utility Functions ─────────────────────────────────────────────────────── */

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
        element.style.color = '';
    }
}

function showErrorState() {
    const errorElements = [
        'registeredCount', 'unregisteredCount', 'totalCount', 'completionRate',
        'studentsRegistered', 'studentsUnregistered', 
        'employeesRegistered', 'employeesUnregistered'
    ];

    errorElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = 'Error';
            el.style.color = '#e53e3e';
        }
    });
}

function clearErrorState() {
    const elements = document.querySelectorAll('.stat-value');
    elements.forEach(el => {
        el.style.color = '';
    });
}

function updateLastUpdated() {
    const element = document.getElementById('lastUpdated');
    if (element) {
        element.textContent = new Date().toLocaleTimeString();
    }
}

function formatNumber(num) {
    return typeof num === 'number' ? num.toLocaleString() : num;
}

function formatDateTime(isoString) {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return 'Invalid Date';
    }
}

function getTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeJs(text) {
    if (!text) return '';
    return String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;

    const colors = {
        success: { bg: '#10b981', color: 'white' },
        error: { bg: '#ef4444', color: 'white' },
        warning: { bg: '#f59e0b', color: 'white' },
        info: { bg: '#4f46e5', color: 'white' }
    };

    const { bg, color } = colors[type] || colors.info;

    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 14px 22px;
        border-radius: 10px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        font-size: 13.5px;
        font-weight: 600;
        z-index: 10005;
        background: ${bg};
        color: ${color};
        max-width: 420px;
        animation: slideIn 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }
    }, type === 'error' ? 6000 : 3500);
}

// Add animation styles for toast
const animStyle = document.createElement('style');
animStyle.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(animStyle);

console.log('Admin dashboard JavaScript initialized');