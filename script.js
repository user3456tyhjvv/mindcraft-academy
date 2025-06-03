// Supabase configuration - Replace with your actual credentials
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

// Initialize Supabase client
let supabaseClient;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Check if Supabase is loaded
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase initialized successfully');
        
        // Check for existing session
        checkUserSession();
    } else {
        console.error('Supabase not loaded');
        showNotification('Supabase connection failed', 'error');
    }
});

// User session management
let currentUser = null;

async function checkUserSession() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) {
            console.error('Session error:', error);
            return;
        }

        if (session) {
            currentUser = session.user;
            updateUserInterface();
            showNotification(`Welcome back, ${currentUser.email}!`, 'success');
        }
    } catch (error) {
        console.error('Error checking session:', error);
    }
}

function updateUserInterface() {
    const authButtons = document.getElementById('authButtons');
    const profileContainer = document.getElementById('profileContainer');
    const profileName = document.getElementById('profileName');
    const profileInitial = document.getElementById('profileInitial');

    if (currentUser) {
        authButtons.style.display = 'none';
        profileContainer.style.display = 'flex';
        
        const displayName = currentUser.user_metadata?.name || currentUser.email.split('@')[0];
        profileName.textContent = displayName;
        profileInitial.textContent = displayName.charAt(0).toUpperCase();
    } else {
        authButtons.style.display = 'flex';
        profileContainer.style.display = 'none';
    }
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Show with animation
    setTimeout(() => notification.classList.add('show'), 100);

    // Auto remove after 5 seconds
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

// Authentication functions
function showAuthModal(type) {
    const authModal = document.getElementById('authModal');
    const formTitle = document.getElementById('formTitle');
    const submitButton = document.getElementById('submitButton');
    const formFooter = document.getElementById('formFooter');
    const nameGroup = document.getElementById('nameGroup');
    const authForm = document.getElementById('authForm');

    authModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (type === 'login') {
        formTitle.textContent = 'Welcome Back';
        submitButton.textContent = 'Sign In';
        formFooter.innerHTML = 'Don\'t have an account? <a onclick="toggleForm(\'signup\')">Sign up</a>';
        nameGroup.style.display = 'none';
        authForm.dataset.type = 'login';
    } else if (type === 'signup') {
        formTitle.textContent = 'Join MindCraft Academy';
        submitButton.textContent = 'Create Account';
        formFooter.innerHTML = 'Already have an account? <a onclick="toggleForm(\'login\')">Sign in</a>';
        nameGroup.style.display = 'block';
        authForm.dataset.type = 'signup';
    }
}

function closeAuthModal() {
    const authModal = document.getElementById('authModal');
    const authForm = document.getElementById('authForm');
    
    authModal.classList.remove('active');
    document.body.style.overflow = '';
    authForm.reset();
}

function toggleForm(type) {
    showAuthModal(type);
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    
    if (!supabaseClient) {
        showNotification('Supabase not connected', 'error');
        return;
    }

    const authForm = document.getElementById('authForm');
    const formType = authForm.dataset.type;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const name = document.getElementById('name')?.value;

    // Show loading state
    const submitButton = document.getElementById('submitButton');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Processing...';
    submitButton.disabled = true;

    try {
        if (formType === 'signup') {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        name: name
                    }
                }
            });

            if (error) {
                showNotification(error.message, 'error');
                return;
            }

            if (data.user) {
                currentUser = data.user;
                updateUserInterface();
                closeAuthModal();
                showNotification(`Welcome to MindCraft Academy, ${name}! Please check your email to verify your account.`, 'success');
            }

        } else if (formType === 'login') {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                showNotification(error.message, 'error');
                return;
            }

            if (data.user) {
                currentUser = data.user;
                updateUserInterface();
                closeAuthModal();
                const displayName = data.user.user_metadata?.name || email.split('@')[0];
                showNotification(`Welcome back, ${displayName}!`, 'success');
            }
        }
    } catch (error) {
        console.error('Auth error:', error);
        showNotification('Authentication failed. Please try again.', 'error');
    } finally {
        // Reset button state
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

async function logout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        
        if (error) {
            showNotification(error.message, 'error');
            return;
        }

        currentUser = null;
        updateUserInterface();
        showNotification('You have been signed out successfully', 'success');
        
        // Close profile menu
        const profileMenu = document.getElementById('profileMenu');
        profileMenu.classList.remove('active');
        
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Logout failed. Please try again.', 'error');
    }
}

// Tab management
function showTab(tabName) {
    // Hide all tab contents
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));

    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Show selected tab content
    document.getElementById(tabName).classList.add('active');

    // Add active class to clicked tab
    event.target.classList.add('active');
}

// Audio player functions
function toggleAudio(trackName) {
    const button = event.target;
    if (button.innerHTML === '▶') {
        button.innerHTML = '⏸';
        button.style.background = '#8b4513';
        showNotification(`Now playing: ${trackName.charAt(0).toUpperCase() + trackName.slice(1)} audiobook`, 'info');
        // Simulate playing
        setTimeout(() => {
            if (button.innerHTML === '⏸') {
                button.innerHTML = '▶';
                button.style.background = '#d4af37';
            }
        }, 5000);
    } else {
        button.innerHTML = '▶';
        button.style.background = '#d4af37';
    }
}

// Video player functions
function playVideo(videoName) {
    showNotification(`🎬 Loading video: ${videoName.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`, 'info');
}

// Routine builder functions
function selectBlock(element, time) {
    element.classList.toggle('selected');
    
    if (element.classList.contains('selected')) {
        showNotification(`✅ Added ${time} to your routine!`, 'success');
    } else {
        showNotification(`❌ Removed ${time} from your routine`, 'warning');
    }
}

function saveRoutine() {
    const selectedBlocks = document.querySelectorAll('.time-block.selected').length;
    if (selectedBlocks === 0) {
        showNotification('🎯 Select some time blocks first to create your routine!', 'warning');
        return;
    }

    showNotification(`🏆 Routine Saved! You've selected ${selectedBlocks} time blocks.`, 'success');
}

// Progress tracking
function updateProgress() {
    showNotification('📈 Progress Updated! Keep building momentum!', 'success');
}

// Newsletter subscription
function subscribeNewsletter(event) {
    event.preventDefault();
    const email = event.target.querySelector('.email-input').value;

    if (email) {
        showNotification(`🎉 Welcome to the MindCraft Community! Check your email for the bonus guide.`, 'success');
        event.target.querySelector('.email-input').value = '';
    }
}

// Profile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    const profileContainer = document.getElementById('profileContainer');
    const profileMenu = document.getElementById('profileMenu');
    
    if (profileContainer) {
        profileContainer.addEventListener('click', function(e) {
            e.stopPropagation();
            profileMenu.classList.toggle('active');
        });
    }

    // Close profile menu when clicking elsewhere
    document.addEventListener('click', function() {
        if (profileMenu) {
            profileMenu.classList.remove('active');
        }
    });
});