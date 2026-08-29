// ═══════════════════════════════════════════════════════════════════════════
// Admin Dashboard JavaScript with Auth & Member Control
// ═══════════════════════════════════════════════════════════════════════════

console.log('Admin JavaScript loaded');

// Global variables
let autoRefreshInterval = null;
let autoRefreshEnabled = false;
let currentMemberPage = 1;
let currentSearchTerm = '';
let currentFilterYear = 'all';
let currentFilterDept = 'all';
let cachedFilterOptions = { years: [], departments: [] };
let cachedStatsData = null;
let deptSearchTerm = '';
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
            loadFilterOptions();
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

        loadFilterOptions();
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
            <div class="breakdown-header">
                <div>
                    <h2>📊 Registration & Category Breakdown</h2>
                    <p class="section-desc" style="margin-bottom: 0;">Overview by role, academic year, and branch / department.</p>
                </div>
            </div>

            <!-- Role Breakdown Cards -->
            <div class="breakdown-grid" style="margin-top: 16px;">
                <div class="breakdown-card">
                    <h3>👨‍🎓 Students</h3>
                    <div class="breakdown-stats">
                        <div class="breakdown-item">
                            <span class="breakdown-label">Completed:</span>
                            <span class="breakdown-value text-success" id="studentsRegistered">-</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="breakdown-label">Pending:</span>
                            <span class="breakdown-value text-warning" id="studentsUnregistered">-</span>
                        </div>
                    </div>
                </div>

                <div class="breakdown-card">
                    <h3>👨‍💼 Employees / Faculty</h3>
                    <div class="breakdown-stats">
                        <div class="breakdown-item">
                            <span class="breakdown-label">Completed:</span>
                            <span class="breakdown-value text-success" id="employeesRegistered">-</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="breakdown-label">Pending:</span>
                            <span class="breakdown-value text-warning" id="employeesUnregistered">-</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Year-Wise Breakdown -->
            <div class="analytics-subblock">
                <div class="subblock-header">
                    <h4>🎓 Year-Wise Student Progress</h4>
                    <span class="subblock-hint">Click any year card to filter member records below</span>
                </div>
                <div class="year-breakdown-grid" id="yearBreakdownGrid">
                    <div class="loading-placeholder">Loading year data...</div>
                </div>
            </div>

            <!-- Department-Wise Breakdown -->
            <div class="analytics-subblock">
                <div class="subblock-header">
                    <h4>🏢 Department & Branch Progress</h4>
                    <div class="dept-search-wrap">
                        <span class="search-mini-icon">🔍</span>
                        <input type="text" id="deptBreakdownSearch" placeholder="Filter departments list..." oninput="onDeptSearchInput(event)" />
                    </div>
                </div>
                <div class="dept-breakdown-container" id="deptBreakdownContainer">
                    <div class="loading-placeholder">Loading department data...</div>
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
                        <small>Excel sheet of participants who completed the pledge (respects current filters)</small>
                    </span>
                </button>

                <button class="export-btn unregistered-btn" onclick="downloadUnregistered()">
                    <span class="btn-icon">📋</span>
                    <span class="btn-text">
                        <strong>Download Unregistered List</strong>
                        <small>Excel sheet of eligible participants yet to complete (respects current filters)</small>
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
        <div class="management-section" id="managementSection">
            <div class="section-header-wrap">
                <div>
                    <h2>👥 Member Management & Oath Control</h2>
                    <p class="section-desc">Filter by <strong>Academic Year</strong>, <strong>Department / Branch</strong>, <strong>Type</strong> or <strong>Status</strong> to reset oath status or manage records.</p>
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
                    <select id="memberTypeFilter" onchange="onFilterChange()" title="Filter by Member Type">
                        <option value="all">👥 All Types</option>
                        <option value="student">👨‍🎓 Students Only</option>
                        <option value="employee">👨‍💼 Employees Only</option>
                    </select>

                    <select id="memberStatusFilter" onchange="onFilterChange()" title="Filter by Oath Status">
                        <option value="all">⚖️ All Statuses</option>
                        <option value="completed">✅ Completed</option>
                        <option value="pending">⏳ Pending</option>
                    </select>

                    <select id="memberYearFilter" onchange="onFilterChange()" title="Filter by Academic Year">
                        <option value="all">🎓 All Years</option>
                    </select>

                    <select id="memberDeptFilter" onchange="onFilterChange()" title="Filter by Department or Branch">
                        <option value="all">🏢 All Departments</option>
                    </select>

                    <button id="resetFiltersBtn" class="btn-reset-filters" onclick="resetAllFilters()" title="Reset all filters to default">
                        🔄 Reset
                    </button>
                </div>
            </div>

            <!-- Active Filter Indicators -->
            <div id="activeFiltersSummary" class="active-filters-bar" style="display: none;"></div>

            <!-- Members Data Table -->
            <div class="table-container">
                <table class="registrations-table management-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Identifier / Reg No</th>
                            <th>Name</th>
                            <th>Department / Branch & Year</th>
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

    populateFilterDropdowns();
}

const KNOWN_ACRONYMS = new Set([
  "CSE", "DCSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AI", "ML", "AIDS", "CSBS", "AIML",
  "MCA", "MBA", "BCA", "BBA", "BTECH", "MTECH", "PHD", "BSC", "MSC", "B.TECH", "M.TECH",
  "VU", "APO"
]);

function toCleanTitleCase(str) {
  if (!str) return "";
  let clean = String(str).trim().replace(/\s+/g, " ");
  clean = clean.replace(/\band\b/gi, "&").replace(/\s*&\s*/g, " & ");
  
  const words = clean.split(" ");
  const formattedWords = words.map(word => {
    const parenMatch = word.match(/^\((.*)\)$/);
    if (parenMatch) {
      const inner = parenMatch[1].toUpperCase();
      return `(${inner})`;
    }
    const upper = word.toUpperCase();
    if (KNOWN_ACRONYMS.has(upper)) return upper;
    if (['&', 'of', 'in', 'the', 'for'].includes(word.toLowerCase())) {
      return word.toLowerCase() === '&' ? '&' : word.toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  let result = formattedWords.join(" ");
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}

let currentFilterCounts = null;

/* ─── Filter Options Loading & Helpers ───────────────────────────────────────── */

async function loadFilterOptions() {
    try {
        const res = await authenticatedFetch('/APO/admin/filter-options?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        if (!data.ok) return;

        cachedFilterOptions = {
            years: data.years || [],
            departments: data.departments || []
        };

        populateFilterDropdowns();
    } catch (err) {
        console.warn('Failed to load filter options:', err.message);
    }
}

function populateFilterDropdowns() {
    const yearSelect = document.getElementById('memberYearFilter');
    const deptSelect = document.getElementById('memberDeptFilter');

    // Extract years from cachedFilterOptions or stats
    let yearList = [];
    if (cachedFilterOptions.years && cachedFilterOptions.years.length > 0) {
        yearList = cachedFilterOptions.years.map(y => {
            if (typeof y === 'object' && y !== null) {
                return { year: String(y.year).trim(), count: y.count || 0 };
            }
            return { year: String(y).trim(), count: 0 };
        });
    } else if (cachedStatsData && Array.isArray(cachedStatsData.yearStats)) {
        yearList = cachedStatsData.yearStats.map(y => ({
            year: String(y.year).trim(),
            count: y.total || 0
        }));
    }

    yearList = yearList.filter(y => y.year && y.year.length > 0 && y.year !== 'Unknown');
    yearList.sort((a, b) => {
        const numA = parseInt(a.year, 10);
        const numB = parseInt(b.year, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.year.localeCompare(b.year);
    });

    // Extract departments from cachedFilterOptions or stats
    let deptList = [];
    if (cachedFilterOptions.departments && cachedFilterOptions.departments.length > 0) {
        deptList = cachedFilterOptions.departments.map(d => {
            if (typeof d === 'object' && d !== null) {
                return { name: toCleanTitleCase(d.name || d.department), count: d.count || d.total || 0 };
            }
            return { name: toCleanTitleCase(d), count: 0 };
        });
    } else if (cachedStatsData && Array.isArray(cachedStatsData.departmentStats)) {
        deptList = cachedStatsData.departmentStats.map(d => ({
            name: toCleanTitleCase(d.department),
            count: d.total || 0
        }));
    }

    // Deduplicate by lowercase name
    const deptMap = new Map();
    deptList.forEach(d => {
        if (!d.name || d.name.toLowerCase() === 'general') return;
        const key = d.name.toLowerCase();
        if (!deptMap.has(key)) {
            deptMap.set(key, { name: d.name, count: d.count });
        } else {
            deptMap.get(key).count += d.count;
        }
    });

    const uniqueDepts = Array.from(deptMap.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
    });

    if (yearSelect) {
        const prevYear = yearSelect.value || currentFilterYear || 'all';
        let html = '<option value="all">🎓 All Academic Years</option>';
        yearList.forEach(y => {
            const countLabel = y.count > 0 ? ` (${formatNumber(y.count)})` : '';
            const label = formatYearLabel(y.year) + countLabel;
            html += `<option value="${escapeHtml(y.year)}" ${prevYear === y.year ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        });
        yearSelect.innerHTML = html;
        if (prevYear && prevYear !== 'all') yearSelect.value = prevYear;
    }

    if (deptSelect) {
        const prevDept = deptSelect.value || currentFilterDept || 'all';
        let html = '<option value="all">🏢 All Departments / Branches</option>';
        uniqueDepts.forEach(d => {
            const countLabel = d.count > 0 ? ` (${formatNumber(d.count)})` : '';
            const label = d.name + countLabel;
            html += `<option value="${escapeHtml(d.name)}" ${prevDept.toLowerCase() === d.name.toLowerCase() ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        });
        deptSelect.innerHTML = html;
        if (prevDept && prevDept !== 'all') deptSelect.value = prevDept;
    }
}

function formatYearLabel(y) {
    if (!y) return 'Unknown Year';
    const num = parseInt(y, 10);
    if (!isNaN(num)) {
        const suffix = getOrdinal(num);
        return `Year ${num} (${suffix} Year)`;
    }
    return `Year ${y}`;
}

function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function resetAllFilters() {
    const searchInput = document.getElementById('memberSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const typeSelect = document.getElementById('memberTypeFilter');
    const statusSelect = document.getElementById('memberStatusFilter');
    const yearSelect = document.getElementById('memberYearFilter');
    const deptSelect = document.getElementById('memberDeptFilter');

    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    if (typeSelect) typeSelect.value = 'all';
    if (statusSelect) statusSelect.value = 'all';
    if (yearSelect) yearSelect.value = 'all';
    if (deptSelect) deptSelect.value = 'all';

    currentSearchTerm = '';
    currentFilterYear = 'all';
    currentFilterDept = 'all';

    updateActiveFiltersSummary();
    loadMembers(1);
    showNotification('All filters reset', 'info');
}

function filterByYear(year) {
    const yearSelect = document.getElementById('memberYearFilter');
    if (yearSelect) {
        yearSelect.value = year;
        currentFilterYear = year;
    }
    const typeSelect = document.getElementById('memberTypeFilter');
    if (typeSelect && typeSelect.value === 'employee') {
        typeSelect.value = 'all';
    }
    onFilterChange();
    scrollToManagement();
    showNotification(`Filtered by Year ${year}`, 'info');
}

function filterByDept(dept) {
    const deptSelect = document.getElementById('memberDeptFilter');
    if (deptSelect) {
        deptSelect.value = dept;
        currentFilterDept = dept;
    }
    onFilterChange();
    scrollToManagement();
    showNotification(`Filtered by: ${dept}`, 'info');
}

function scrollToManagement() {
    const target = document.getElementById('managementSection');
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function updateActiveFiltersSummary() {
    const bar = document.getElementById('activeFiltersSummary');
    if (!bar) return;

    const type = document.getElementById('memberTypeFilter')?.value || 'all';
    const status = document.getElementById('memberStatusFilter')?.value || 'all';
    const year = document.getElementById('memberYearFilter')?.value || 'all';
    const dept = document.getElementById('memberDeptFilter')?.value || 'all';
    const search = currentSearchTerm.trim();

    const activeChips = [];

    if (search) {
        activeChips.push(`<span class="filter-chip">🔍 "${escapeHtml(search)}" <button onclick="clearSearch()">✕</button></span>`);
    }
    if (type !== 'all') {
        const label = type === 'student' ? '👨‍🎓 Students' : '👨‍💼 Employees';
        activeChips.push(`<span class="filter-chip">${label} <button onclick="document.getElementById('memberTypeFilter').value='all';onFilterChange();">✕</button></span>`);
    }
    if (status !== 'all') {
        const label = status === 'completed' ? '✅ Completed' : '⏳ Pending';
        activeChips.push(`<span class="filter-chip">${label} <button onclick="document.getElementById('memberStatusFilter').value='all';onFilterChange();">✕</button></span>`);
    }
    if (year !== 'all') {
        activeChips.push(`<span class="filter-chip chip-highlight">🎓 Year ${escapeHtml(year)} <button onclick="document.getElementById('memberYearFilter').value='all';onFilterChange();">✕</button></span>`);
    }
    if (dept !== 'all') {
        activeChips.push(`<span class="filter-chip chip-highlight">🏢 ${escapeHtml(dept)} <button onclick="document.getElementById('memberDeptFilter').value='all';onFilterChange();">✕</button></span>`);
    }

    let countsBadgeHtml = '';
    if (currentFilterCounts && typeof currentFilterCounts.total === 'number') {
        countsBadgeHtml = `
            <div class="active-count-indicator">
                📊 <strong>${formatNumber(currentFilterCounts.total)}</strong> Found
                <span class="count-pill pill-completed">✅ ${formatNumber(currentFilterCounts.completed)}</span>
                <span class="count-pill pill-pending">⏳ ${formatNumber(currentFilterCounts.pending)}</span>
            </div>
        `;
    }

    if (activeChips.length > 0 || countsBadgeHtml) {
        bar.style.display = 'flex';
        bar.innerHTML = `
            <div class="active-filters-left">
                ${countsBadgeHtml}
                <div class="active-chips-list">${activeChips.join('')}</div>
            </div>
            ${activeChips.length > 0 ? '<button class="clear-all-chip-btn" onclick="resetAllFilters()">Clear All</button>' : ''}
        `;
    } else {
        bar.style.display = 'none';
        bar.innerHTML = '';
    }
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

        cachedStatsData = data;
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

        // Role Breakdown
        updateElement('studentsRegistered', formatNumber(data.registered.students));
        updateElement('studentsUnregistered', formatNumber(data.unregistered.students));
        updateElement('employeesRegistered', formatNumber(data.registered.employees));
        updateElement('employeesUnregistered', formatNumber(data.unregistered.employees));

        // Year-wise Analytics Breakdown
        renderYearBreakdown(data.yearStats || []);

        // Department-wise Analytics Breakdown
        renderDepartmentBreakdown(data.departmentStats || []);

        // Recent registrations
        updateRecentRegistrations(data.recentRegistrations || []);

        // Populate Year and Department filters if needed
        populateFilterDropdowns();

        clearErrorState();

    } catch (error) {
        console.error('Error updating UI:', error);
    }
}

function renderYearBreakdown(yearStats) {
    const grid = document.getElementById('yearBreakdownGrid');
    if (!grid) return;

    if (!yearStats || yearStats.length === 0) {
        grid.innerHTML = '<div class="loading-placeholder">No year records found.</div>';
        return;
    }

    grid.innerHTML = yearStats.map(y => {
        const rateNum = parseFloat(y.rate) || 0;
        return `
            <div class="year-card" onclick="filterByYear('${escapeJs(y.year)}')" title="Click to filter members by Year ${escapeHtml(y.year)}">
                <div class="year-card-top">
                    <div class="year-pill-badge">🎓 Year ${escapeHtml(y.year)}</div>
                    <span class="year-rate-badge">${y.rate}% Completed</span>
                </div>
                <div class="year-progress-track">
                    <div class="year-progress-fill" style="width: ${rateNum}%;"></div>
                </div>
                <div class="year-card-metrics">
                    <div class="metric-item">
                        <span class="metric-label">Completed</span>
                        <span class="metric-val text-success">${formatNumber(y.registered)}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Pending</span>
                        <span class="metric-val text-warning">${formatNumber(y.unregistered)}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Total</span>
                        <span class="metric-val">${formatNumber(y.total)}</span>
                    </div>
                </div>
                <div class="year-card-footer">
                    <span>🔍 View Year ${escapeHtml(y.year)} Members →</span>
                </div>
            </div>
        `;
    }).join('');
}

function onDeptSearchInput(e) {
    deptSearchTerm = (e.target.value || '').trim().toLowerCase();
    if (cachedStatsData && cachedStatsData.departmentStats) {
        renderDepartmentBreakdown(cachedStatsData.departmentStats);
    }
}

function renderDepartmentBreakdown(deptStats) {
    const container = document.getElementById('deptBreakdownContainer');
    if (!container) return;

    if (!deptStats || deptStats.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">No department records found.</div>';
        return;
    }

    let filtered = deptStats;
    if (deptSearchTerm) {
        filtered = deptStats.filter(d => d.department.toLowerCase().includes(deptSearchTerm));
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="loading-placeholder">No departments matching "${escapeHtml(deptSearchTerm)}"</div>`;
        return;
    }

    container.innerHTML = `
        <div class="dept-table-wrap">
            <table class="dept-stats-table">
                <thead>
                    <tr>
                        <th>Department / Branch</th>
                        <th style="text-align: center;">Completion Rate</th>
                        <th style="text-align: right;">Completed</th>
                        <th style="text-align: right;">Pending</th>
                        <th style="text-align: right;">Total</th>
                        <th style="text-align: center;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(d => {
                        const rateNum = parseFloat(d.rate) || 0;
                        return `
                            <tr>
                                <td>
                                    <div class="dept-table-name">
                                        <strong>${escapeHtml(d.department)}</strong>
                                    </div>
                                </td>
                                <td>
                                    <div class="dept-rate-col">
                                        <div class="dept-rate-bar-track">
                                            <div class="dept-rate-bar-fill" style="width: ${rateNum}%;"></div>
                                        </div>
                                        <span class="dept-rate-text">${d.rate}%</span>
                                    </div>
                                </td>
                                <td style="text-align: right;"><strong class="text-success">${formatNumber(d.registered)}</strong></td>
                                <td style="text-align: right;"><span class="text-warning">${formatNumber(d.unregistered)}</span></td>
                                <td style="text-align: right;"><strong>${formatNumber(d.total)}</strong></td>
                                <td style="text-align: center;">
                                    <button class="btn-table-filter" onclick="filterByDept('${escapeJs(d.department)}')" title="Filter member list by this department">
                                        🔍 Filter
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
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
        updateActiveFiltersSummary();
        loadMembers(1);
    }, 300);
}

function clearSearch() {
    const input = document.getElementById('memberSearchInput');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.style.display = 'none';

    currentSearchTerm = '';
    updateActiveFiltersSummary();
    loadMembers(1);
}

function onFilterChange() {
    currentFilterYear = document.getElementById('memberYearFilter')?.value || 'all';
    currentFilterDept = document.getElementById('memberDeptFilter')?.value || 'all';
    updateActiveFiltersSummary();
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
    const yearFilter = document.getElementById('memberYearFilter')?.value || 'all';
    const deptFilter = document.getElementById('memberDeptFilter')?.value || 'all';
    const search = currentSearchTerm.trim();

    try {
        const queryParams = new URLSearchParams({
            q: search,
            type: typeFilter,
            status: statusFilter,
            year: yearFilter,
            department: deptFilter,
            page: page,
            limit: 15,
            t: Date.now()
        });

        const res = await authenticatedFetch(`/APO/admin/members?${queryParams.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed to fetch members');

        currentFilterCounts = data.filterCounts || {
            total: data.pagination?.total || 0,
            completed: 0,
            pending: 0
        };

        updateActiveFiltersSummary();
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
                    <div class="dept-cell-wrap">
                        <span class="dept-title">${escapeHtml(toCleanTitleCase(m.department || 'N/A'))}</span>
                        <div class="dept-badges-row">
                            ${m.branch_shortname ? `<span class="branch-pill">${escapeHtml(m.branch_shortname)}</span>` : ''}
                            ${m.cyear ? `<span class="year-pill">Year ${escapeHtml(m.cyear)}${m.sectioncode ? ` • Sec ${escapeHtml(m.sectioncode)}` : ''}</span>` : ''}
                        </div>
                    </div>
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
    
    if (info) {
        if (currentFilterCounts && typeof currentFilterCounts.completed === 'number') {
            info.innerHTML = `Showing ${start}-${end} of <strong>${formatNumber(total)}</strong> members (<span style="color:#059669;font-weight:600;">${formatNumber(currentFilterCounts.completed)} Completed</span> • <span style="color:#d97706;font-weight:600;">${formatNumber(currentFilterCounts.pending)} Pending</span>)`;
        } else {
            info.textContent = `Showing ${start}-${end} of ${formatNumber(total)} members`;
        }
    }
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
    const year = document.getElementById('memberYearFilter')?.value || 'all';
    const dept = document.getElementById('memberDeptFilter')?.value || 'all';
    const params = new URLSearchParams();
    if (year !== 'all') params.append('year', year);
    if (dept !== 'all') params.append('department', dept);
    const qs = params.toString() ? `?${params.toString()}` : '';
    await downloadFile(`/APO/admin/export/registered${qs}`, 'registered_participants');
}

async function downloadUnregistered() {
    const year = document.getElementById('memberYearFilter')?.value || 'all';
    const dept = document.getElementById('memberDeptFilter')?.value || 'all';
    const params = new URLSearchParams();
    if (year !== 'all') params.append('year', year);
    if (dept !== 'all') params.append('department', dept);
    const qs = params.toString() ? `?${params.toString()}` : '';
    await downloadFile(`/APO/admin/export/unregistered${qs}`, 'unregistered_participants');
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