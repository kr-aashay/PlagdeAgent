// Admin Dashboard JavaScript
console.log('Admin JavaScript loaded');

// Global variables
let autoRefreshInterval = null;
let autoRefreshEnabled = false;

// Initialize dashboard when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}

function initDashboard() {
    console.log('Initializing admin dashboard...');
    
    // Load data immediately
    loadDashboardData();
    
    // Set up auto-refresh every 30 seconds
    setInterval(loadDashboardData, 30000);
    
    // Set up keyboard shortcuts
    setupKeyboardShortcuts();
}

// Load dashboard data from API
async function loadDashboardData() {
    console.log('Loading dashboard data...');
    
    try {
        const response = await fetch('/APO/admin/stats?t=' + Date.now());
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Data received:', data);
        
        if (!data.ok) {
            throw new Error(data.error || 'API returned error');
        }
        
        // Update the UI
        updateDashboardUI(data);
        updateLastUpdated();
        
        console.log('Dashboard updated successfully');
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showNotification(`Failed to load data: ${error.message}`, 'error');
        showErrorState();
    }
}

// Update dashboard UI with data
function updateDashboardUI(data) {
    console.log('Updating dashboard UI...');
    
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
        
        // Clear any error styling
        clearErrorState();
        
        console.log('UI updated successfully');
        
    } catch (error) {
        console.error('Error updating UI:', error);
        showNotification('Error updating display', 'error');
    }
}

// Update a single element safely
function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
        element.style.color = ''; // Clear any error styling
    } else {
        console.warn(`Element not found: ${id}`);
    }
}

// Update recent registrations table
function updateRecentRegistrations(registrations) {
    const tbody = document.getElementById('recentRegistrations');
    if (!tbody) {
        console.warn('Recent registrations table not found');
        return;
    }
    
    if (registrations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No recent registrations</td></tr>';
        return;
    }
    
    tbody.innerHTML = registrations.map(reg => `
        <tr>
            <td>
                <span class="type-badge type-${reg.type}">
                    ${reg.type === 'student' ? '👨‍🎓 Student' : '👨‍💼 Employee'}
                </span>
            </td>
            <td><strong>${escapeHtml(reg.id)}</strong></td>
            <td>${escapeHtml(reg.name)}</td>
            <td>${escapeHtml(reg.department || 'N/A')}</td>
            <td>${formatDateTime(reg.registered_at)}</td>
            <td>
                <span class="status-badge ${reg.oath_taken ? 'status-completed' : 'status-pending'}">
                    ${reg.oath_taken ? '✅ Completed' : '⏳ Pending'}
                </span>
            </td>
        </tr>
    `).join('');
}

// Show error state
function showErrorState() {
    const errorElements = [
        'registeredCount', 'unregisteredCount', 'totalCount', 'completionRate',
        'studentsRegistered', 'studentsUnregistered', 
        'employeesRegistered', 'employeesUnregistered'
    ];
    
    errorElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = 'Error';
            element.style.color = '#e53e3e';
        }
    });
    
    const tbody = document.getElementById('recentRegistrations');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading" style="color: #e53e3e;">Failed to load data</td></tr>';
    }
}

// Clear error state
function clearErrorState() {
    const elements = document.querySelectorAll('.stat-value');
    elements.forEach(el => {
        el.style.color = '';
    });
}

// Update last updated time
function updateLastUpdated() {
    const element = document.getElementById('lastUpdated');
    if (element) {
        const now = new Date();
        element.textContent = now.toLocaleString();
    }
}

// Manual refresh
function refreshNow() {
    console.log('Manual refresh triggered');
    const btn = event?.target;
    const originalText = btn?.textContent;
    
    if (btn) {
        btn.textContent = '🔄 Refreshing...';
        btn.disabled = true;
    }
    
    loadDashboardData().finally(() => {
        if (btn) {
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 1000);
        }
    });
    
    showNotification('Dashboard refreshed', 'success');
}

// Download registered participants
async function downloadRegistered() {
    console.log('Downloading registered participants...');
    await downloadFile('/APO/admin/export/registered', 'registered_participants');
}

// Download unregistered participants  
async function downloadUnregistered() {
    console.log('Downloading unregistered participants...');
    await downloadFile('/APO/admin/export/unregistered', 'unregistered_participants');
}

// Generic download function
async function downloadFile(url, filename) {
    const btn = event?.target;
    const originalHTML = btn?.innerHTML;
    
    try {
        if (btn) {
            btn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text"><strong>Downloading...</strong><small>Please wait</small></span>';
            btn.disabled = true;
        }
        
        const response = await fetch(url + '?t=' + Date.now());
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        
        if (blob.size === 0) {
            throw new Error('Downloaded file is empty');
        }
        
        // Create download link
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${filename}_${getTimestamp()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
        
        showNotification('Download completed successfully', 'success');
        
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

// Toggle auto-refresh
function toggleAutoRefresh() {
    const btn = document.getElementById('autoRefreshBtn');
    
    if (autoRefreshEnabled) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        autoRefreshEnabled = false;
        btn.textContent = '🔄 Enable Auto-refresh';
        btn.classList.remove('auto-refresh-active');
        showNotification('Auto-refresh disabled', 'success');
    } else {
        autoRefreshInterval = setInterval(loadDashboardData, 30000);
        autoRefreshEnabled = true;
        btn.textContent = '⏸️ Disable Auto-refresh';
        btn.classList.add('auto-refresh-active');
        showNotification('Auto-refresh enabled (30 seconds)', 'success');
    }
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
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

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    
    // Style the toast
    const colors = {
        success: { bg: '#38a169', color: 'white' },
        error: { bg: '#e53e3e', color: 'white' },
        warning: { bg: '#d69e2e', color: 'white' },
        info: { bg: '#3182ce', color: 'white' }
    };
    
    const { bg, color } = colors[type] || colors.info;
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-size: 14px;
        font-weight: 500;
        z-index: 10001;
        background: ${bg};
        color: ${color};
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }
    }, type === 'error' ? 6000 : 4000);
}

// Utility functions
function formatNumber(num) {
    return typeof num === 'number' ? num.toLocaleString() : num;
}

function formatDateTime(isoString) {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        return date.toLocaleString();
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

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

console.log('Admin dashboard JavaScript initialized');