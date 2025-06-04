
// Notification System
let userNotifications = [];
let notificationInterval = null;

// Notification UI Functions
function updateNotificationUI() {
    const notificationBell = document.getElementById('notificationBell');
    const notificationBadge = document.getElementById('notificationBadge');
    const notificationsList = document.getElementById('notificationsList');

    if (!notificationBell || !currentUser) {
        if (notificationBell) notificationBell.style.display = 'none';
        return;
    }

    // Show notification bell when user is logged in
    notificationBell.style.display = 'block';

    // Update badge count
    const unreadCount = userNotifications.filter(n => !n.is_read).length;
    if (unreadCount > 0) {
        notificationBadge.textContent = unreadCount;
        notificationBadge.style.display = 'block';
    } else {
        notificationBadge.style.display = 'none';
    }

    // Update notifications list
    if (notificationsList) {
        if (userNotifications.length === 0) {
            notificationsList.innerHTML = '<div class="no-notifications">No notifications yet</div>';
        } else {
            notificationsList.innerHTML = userNotifications.map(notification => `
                <div class="notification-item ${notification.is_read ? 'read' : 'unread'}" onclick="markAsRead('${notification.id}')">
                    <div class="notification-message">${notification.message}</div>
                    <div class="notification-time">${formatNotificationTime(notification.created_at)}</div>
                </div>
            `).join('');
        }
    }
}

function toggleNotifications() {
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');

        // Close dropdown when clicking outside
        if (dropdown.classList.contains('active')) {
            setTimeout(() => {
                document.addEventListener('click', function closeDropdown(e) {
                    if (!dropdown.contains(e.target) && !document.getElementById('notificationBell').contains(e.target)) {
                        dropdown.classList.remove('active');
                        document.removeEventListener('click', closeDropdown);
                    }
                });
            }, 100);
        }
    }
}

async function loadUserNotifications() {
    if (!currentUser || !supabaseClient) return;

    try {
        const { data: notifications, error } = await supabaseClient
            .from('user_notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        userNotifications = notifications || [];
        updateNotificationUI();

    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

async function markAsRead(notificationId) {
    if (!currentUser || !supabaseClient) return;

    try {
        const { error } = await supabaseClient
            .from('user_notifications')
            .update({ is_read: true })
            .eq('id', notificationId)
            .eq('user_id', currentUser.id);

        if (error) throw error;

        // Update local notifications
        userNotifications = userNotifications.map(n => 
            n.id === notificationId ? { ...n, is_read: true } : n
        );

        updateNotificationUI();
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllAsRead() {
    if (!currentUser || !supabaseClient) return;

    try {
        const { error } = await supabaseClient
            .from('user_notifications')
            .update({ is_read: true })
            .eq('user_id', currentUser.id)
            .eq('is_read', false);

        if (error) throw error;

        // Update local notifications
        userNotifications = userNotifications.map(n => ({ ...n, is_read: true }));
        updateNotificationUI();

        showNotification('All notifications marked as read', 'success');
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

async function addWelcomeNotification() {
    if (!currentUser || !supabaseClient) return;

    try {
        // Check if welcome notification already exists
        const { data: existing, error: checkError } = await supabaseClient
            .from('user_notifications')
            .select('id')
            .eq('user_id', currentUser.id)
            .ilike('message', '%Welcome to MindCraft Academy%')
            .limit(1);

        if (checkError) throw checkError;

        if (existing && existing.length > 0) {
            console.log('Welcome notification already exists');
            return;
        }

        // Create welcome notification
        const welcomeNotification = {
            user_id: currentUser.id,
            message: `🎉 Welcome to MindCraft Academy! Your transformation journey begins now. Every action you take here builds momentum toward your best self.`,
            type: 'success',
            is_read: false,
            created_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from('user_notifications')
            .insert([welcomeNotification]);

        if (error) throw error;

        // Add to local notifications
        userNotifications.unshift(welcomeNotification);
        updateNotificationUI();

    } catch (error) {
        console.error('Error adding welcome notification:', error);
    }
}

async function addUserNotification(message, type = 'info') {
    if (!currentUser || !supabaseClient) return;

    try {
        const notification = {
            user_id: currentUser.id,
            message: message,
            type: type,
            is_read: false,
            created_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from('user_notifications')
            .insert([notification]);

        if (error) throw error;

        // Add to local notifications and update UI
        userNotifications.unshift(notification);
        updateNotificationUI();

    } catch (error) {
        console.error('Error adding notification:', error);
    }
}

function formatNotificationTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
        return 'Just now';
    } else if (diffInHours < 24) {
        return `${Math.floor(diffInHours)}h ago`;
    } else {
        return `${Math.floor(diffInHours / 24)}d ago`;
    }
}

// General Notification System
function showNotification(message, type = 'info') {
    let container = document.getElementById('notificationContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationContainer';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    container.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 100);

    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return '✅';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        default: return 'ℹ️';
    }
}

// Enhanced styled notifications
function showStyledNotification(title, message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'styled-notification-modal';

    const icons = {
        success: '🎉',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    notification.innerHTML = `
        <div class="styled-notification-overlay">
            <div class="styled-notification-content ${type}">
                <div class="styled-notification-header">
                    <span class="styled-notification-icon">${icons[type]}</span>
                    <h3 class="styled-notification-title">${title}</h3>
                </div>
                <p class="styled-notification-message">${message}</p>
                <button class="styled-notification-close" onclick="this.closest('.styled-notification-modal').remove()">
                    Got it!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 100);

    // Auto remove after 8 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }
    }, 8000);
}

function toggleNotifications() {
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');

        // Close dropdown when clicking outside
        if (dropdown.classList.contains('active')) {
            setTimeout(() => {
                document.addEventListener('click', function closeDropdown(e) {
                    if (!dropdown.contains(e.target) && !document.getElementById('notificationBell').contains(e.target)) {
                        dropdown.classList.remove('active');
                        document.removeEventListener('click', closeDropdown);
                    }
                });
            }, 100);
        }
    }
}

async function markAsRead(notificationId) {
    if (!currentUser || !supabaseClient) return;

    try {
        const { error } = await supabaseClient
            .from('user_notifications')
            .update({ is_read: true })
            .eq('id', notificationId)
            .eq('user_id', currentUser.id);

        if (error) throw error;

        // Update local notifications if they exist
        if (typeof userNotifications !== 'undefined') {
            userNotifications = userNotifications.map(n => 
                n.id === notificationId ? { ...n, is_read: true } : n
            );
            
            if (typeof updateNotificationUI === 'function') {
                updateNotificationUI();
            }
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllAsRead() {
    if (!currentUser || !supabaseClient) return;

    try {
        const { error } = await supabaseClient
            .from('user_notifications')
            .update({ is_read: true })
            .eq('user_id', currentUser.id)
            .eq('is_read', false);

        if (error) throw error;

        // Update local notifications if they exist
        if (typeof userNotifications !== 'undefined') {
            userNotifications = userNotifications.map(n => ({ ...n, is_read: true }));
            
            if (typeof updateNotificationUI === 'function') {
                updateNotificationUI();
            }
        }

        showNotification('All notifications marked as read', 'success');
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}ed notifications
function showStyledNotification(title, message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'styled-notification-modal';

    const icons = {
        success: '🎉',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    notification.innerHTML = `
        <div class="styled-notification-overlay">
            <div class="styled-notification-content ${type}">
                <div class="styled-notification-header">
                    <span class="styled-notification-icon">${icons[type]}</span>
                    <h3 class="styled-notification-title">${title}</h3>
                </div>
                <p class="styled-notification-message">${message}</p>
                <button class="styled-notification-close" onclick="this.closest('.styled-notification-modal').remove()">
                    Got it!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 100);

    // Auto remove after 8 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }
    }, 8000);
}

function showStyledEmailConfirmationNotification(email, name) {
    const notification = document.createElement('div');
    notification.className = 'email-confirmation-notification';
    notification.innerHTML = `
        <div class="email-confirmation-overlay">
            <div class="email-confirmation-content">
                <div class="confirmation-animation">
                    <div class="success-checkmark">
                        <div class="check-icon">
                            <span class="icon-line line-tip"></span>
                            <span class="icon-line line-long"></span>
                            <div class="icon-circle"></div>
                            <div class="icon-fix"></div>
                        </div>
                    </div>
                </div>
                <h2 class="confirmation-title">🎉 Welcome to MindCraft Academy, ${name}!</h2>
                <div class="confirmation-step">
                    <span class="step-number">📧</span>
                    <div class="step-content">
                        <h4>Check Your Email</h4>
                        <p>We've sent a confirmation link to:</p>
                        <div class="email-highlight">${email}</div>
                    </div>
                </div>
                <div class="confirmation-step">
                    <span class="step-number">✅</span>
                    <div class="step-content">
                        <h4>Confirm Your Account</h4>
                        <p>Click the link in your email to activate your account and unlock all features.</p>
                    </div>
                </div>
                <div class="confirmation-step">
                    <span class="step-number">🚀</span>
                    <div class="step-content">
                        <h4>Start Your Journey</h4>
                        <p>Once confirmed, you'll have access to premium content, progress tracking, and your personal transformation tools.</p>
                    </div>
                </div>
                <div class="confirmation-actions">
                    <button onclick="this.closest('.email-confirmation-notification').remove()" class="primary-action-btn">
                        Got it! I'll check my email
                    </button>
                    <button onclick="resendConfirmationEmail('${email}')" class="secondary-action-btn">
                        Resend Email
                    </button>
                </div>
                <p class="confirmation-note">
                    <strong>Pro Tip:</strong> Check your spam folder if you don't see the email within a few minutes.
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 100);
}

function showEmailConfirmationNotification(email) {
    showStyledEmailConfirmationNotification(email, email.split('@')[0]);
}

async function resendConfirmationEmail(email) {
    try {
        const { error } = await supabaseClient.auth.resend({
            type: 'signup',
            email: email,
            options: {
                emailRedirectTo: `${window.location.origin}/email-confirmed`
            }
        });

        if (error) {
            showNotification(error.message, 'error');
            return;
        }

        showNotification('Confirmation email resent!', 'success');
    } catch (error) {
        console.error('Error resending email:', error);
        showNotification('Failed to resend email. Please try again.', 'error');
    }
}
