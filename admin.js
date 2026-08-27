// Admin Dashboard JavaScript

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
});

// Load all dashboard data
async function loadDashboardData() {
    try {
        const response = await fetch('/APO/admin/stats');
        if (!response.ok) {
            throw new Error('Failed to fetch admin stats');
        }
        
        const data = await response.json();
        updateDashboard(data);
        updateLastUpdatedTime();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data. Please try again.');
    }
}

// Update dashboard UI with fetched data
function updateDashboard(data) {
    // Overall stats
    document.getElementById('registeredCount').textContent = data.registered.total;
    document.getElementById('unregisteredCount').textContent = data.unregistered.total;
    document.getElementById('totalCount').textContent = data.total;
    
    const completionRate = data.total > 0 
        ? ((data.registered.total / data.total) * 100).toFixed(1) 
        : '0.0';
    document.getElementById('completionRate').textContent = `${completionRate}%`;
    
    // Breakdown by type
    document.getElementById('studentsRegistered').textContent = data.registered.students;
    document.getElementById('studentsUnregistered').textContent = data.unregistered.students;
    document.getElementById('employeesRegistered').textContent = data.registered.employees;
    document.getElementById('employeesUnregistered').textContent = data.unregistered.employees;
    
    // Recent registrations table
    updateRecentRegistrationsTable(data.recentRegistrations);
}

// Update recent registrations table
function updateRecentRegistrationsTable(registrations) {
    const tbody = document.getElementById('recentRegistrations');
    
    if (!registrations || registrations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No registrations yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = registrations.map(reg => `
        <tr>
            <td>
                <span class="type-badge type-${reg.type}">
                    ${reg.type}
                </span>
            </td>
            <td>${escapeHtml(reg.id)}</td>
            <td>${escapeHtml(reg.name)}</td>
            <td>${escapeHtml(reg.department || 'N/A')}</td>
            <td>${formatDateTime(reg.registered_at)}</td>
            <td>
                <span class="status-badge ${reg.oath_taken ? 'status-completed' : 'status-pending'}">
                    ${reg.oath_taken ? 'Completed' : 'Pending'}
                </span>
            </td>
        </tr>
    `).join('');
}

// Download registered participants Excel
async function downloadRegistered() {
    try {
        const response = await fetch('/APO/admin/export/registered');
        if (!response.ok) {
            throw new Error('Failed to download registered list');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `registered_${getTimestamp()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showSuccess('Registered list downloaded successfully');
    } catch (error) {
        console.error('Error downloading registered list:', error);
        showError('Failed to download registered list. Please try again.');
    }
}

// Download unregistered participants Excel
async function downloadUnregistered() {
    try {
        const response = await fetch('/APO/admin/export/unregistered');
        if (!response.ok) {
            throw new Error('Failed to download unregistered list');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unregistered_${getTimestamp()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showSuccess('Unregistered list downloaded successfully');
    } catch (error) {
        console.error('Error downloading unregistered list:', error);
        showError('Failed to download unregistered list. Please try again.');
    }
}

// Manual refresh
function refreshNow() {
    loadDashboardData();
    showSuccess('Dashboard refreshed');
}

// Update last updated time
function updateLastUpdatedTime() {
    const now = new Date();
    const timeString = now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('lastUpdated').textContent = timeString;
}

// Utility: Format date time
function formatDateTime(isoString) {
    if (!isoString) return 'N/A';
    
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Utility: Get timestamp for filenames
function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// Utility: Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show success message
function showSuccess(message) {
    showNotification(message, 'success');
}

// Show error message
function showError(message) {
    showNotification(message, 'error');
}

// Show notification toast
function showNotification(message, type) {
    // Remove existing notification if any
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    
    // Add styles dynamically
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        ${type === 'success' ? 'background: #38a169; color: white;' : 'background: #e53e3e; color: white;'}
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
