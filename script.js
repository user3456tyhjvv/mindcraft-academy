// Supabase configuration - Replace with your actual credentials
const SUPABASE_URL = 'https://ytqxknpcybvjameqtjpu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0cXhrbnBjeWJ2amFtZXF0anB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NDIzMjUsImV4cCI6MjA2NDUxODMyNX0.s0Aww5v7NX7aigQ6kFR_rCi9z8FUrwCFb5c9qhCKmhI';

// Initialize Supabase client
let supabaseClient;

// Initialize Supabase when the script loads
try {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized successfully');
    } else {
        console.warn('Supabase not loaded - some features may not work');
    }
} catch (error) {
    console.error('Error initializing Supabase:', error);
}

// User session management
let currentUser = null;
let userSubscription = null;
let userProgress = null;
let userRoutine = [];
let editingMode = false;
let currentEditingBlock = null;

// Notification system
let userNotifications = [];
let notificationInterval = null;

// Audio tracking
let currentlyPlaying = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Wait a moment for Supabase script to fully load
    setTimeout(() => {
        try {
            if (typeof supabase !== 'undefined' && supabase.createClient) {
                supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log('Supabase initialized successfully');
                
                // Handle email confirmation redirect
                handleEmailConfirmation();
                
                // Handle password reset redirect
                handlePasswordReset();
                
                checkUserSession();
                setupAudioPlayers();
                showNotification('Welcome to MindCraft Academy!', 'success');
            } else {
                console.error('Supabase not loaded properly');
                showNotification('Database connection unavailable - some features may be limited', 'warning');
            }
        } catch (error) {
            console.error('Error during initialization:', error);
            showNotification('Initialization error - some features may be limited', 'warning');
        }
    }, 100);
});

// Handle email confirmation from URL parameters
async function handleEmailConfirmation() {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    const type = urlParams.get('type');

    if (type === 'signup' && accessToken && refreshToken) {
        try {
            const { data, error } = await supabaseClient.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            });

            if (error) throw error;

            // Create user profile after email confirmation
            if (data.user) {
                currentUser = data.user;
                await createUserProfile(
                    data.user.user_metadata?.name || data.user.email.split('@')[0],
                    data.user.email
                );
                updateUserInterface();
                showNotification('🎉 Email confirmed! Welcome to MindCraft Academy!', 'success');
                
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (error) {
            console.error('Email confirmation error:', error);
            showNotification('Email confirmation failed. Please try logging in.', 'error');
        }
    }
}

// Handle password reset from URL parameters
async function handlePasswordReset() {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    const type = urlParams.get('type');

    if (type === 'recovery' && accessToken && refreshToken) {
        try {
            const { data, error } = await supabaseClient.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            });

            if (error) throw error;

            // Show password reset form
            showPasswordResetModal();
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
            console.error('Password reset error:', error);
            showNotification('Password reset link is invalid or expired.', 'error');
        }
    }
}

function showPasswordResetModal() {
    const authModal = document.getElementById('authModal');
    const formTitle = document.getElementById('formTitle');
    const submitButton = document.getElementById('submitButton');
    const formFooter = document.getElementById('formFooter');
    const nameGroup = document.getElementById('nameGroup');
    const authForm = document.getElementById('authForm');
    const emailGroup = document.querySelector('#email').parentElement;

    authModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    formTitle.textContent = 'Set New Password';
    submitButton.textContent = 'Update Password';
    formFooter.innerHTML = '';
    nameGroup.style.display = 'none';
    emailGroup.style.display = 'none';
    authForm.dataset.type = 'reset-password';
    
    // Change password field placeholder
    document.getElementById('password').placeholder = 'Enter your new password';
}

// Supabase Database Setup Functions
async function initializeUserTables() {
    if (!supabaseClient) return;

    try {
        // Create user profile if doesn't exist
        const { data: profiles, error: profileError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id);

        if (profileError) {
            throw profileError;
        }

        if (!profiles || profiles.length === 0) {
            // Profile doesn't exist, create it
            const { error: createError } = await supabaseClient
                .from('profiles')
                .insert([{
                    id: currentUser.id,
                    email: currentUser.email,
                    name: currentUser.user_metadata?.name || currentUser.email.split('@')[0],
                    created_at: new Date().toISOString(),
                    subscription_status: 'free',
                    join_date: new Date().toISOString()
                }]);

            if (createError) throw createError;
        }

        // Initialize progress tracking
        await initializeUserProgress();

        // Load user routine
        await loadUserRoutine();

    } catch (error) {
        console.error('Error initializing user tables:', error);
        showNotification('Error setting up user data', 'error');
    }
}

async function initializeUserProgress() {
    try {
        const { data: progressArray, error } = await supabaseClient
            .from('user_progress')
            .select('*')
            .eq('user_id', currentUser.id);

        if (error) {
            throw error;
        }

        if (!progressArray || progressArray.length === 0) {
            // No progress record exists, create one
            const initialProgress = {
                user_id: currentUser.id,
                start_date: new Date().toISOString(),
                current_streak: 0,
                total_days: 0,
                habits_completed: {},
                audio_progress: {},
                video_progress: {},
                last_updated: new Date().toISOString()
            };

            const { error: insertError } = await supabaseClient
                .from('user_progress')
                .insert([initialProgress]);

            if (insertError) throw insertError;
            userProgress = initialProgress;
        } else {
            userProgress = progressArray[0];
        }
    } catch (error) {
        console.error('Error initializing progress:', error);
    }
}

async function loadUserRoutine() {
    try {
        const { data: routine, error } = await supabaseClient
            .from('user_routines')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('start_time');

        if (!error && routine) {
            userRoutine = routine;
            displayUserRoutine();
        }
    } catch (error) {
        console.error('Error loading routine:', error);
    }
}

// User session management
async function checkUserSession() {
    if (!supabaseClient || !supabaseClient.auth) {
        console.warn('Supabase not properly initialized');
        showNotification('Database connection not available', 'warning');
        return;
    }

    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error) {
            console.error('Session error:', error);
            return;
        }

        if (session) {
            currentUser = session.user;
            await initializeUserTables();
            updateUserInterface();
            
            // Load and show notifications
            await loadUserNotifications();
            
            // Show welcome notification
            await addWelcomeNotification();
            
            showNotification(`Welcome back, ${currentUser.email}!`, 'success');

            // Check subscription status
            await checkSubscriptionStatus();
        }
    } catch (error) {
        console.error('Error checking session:', error);
        showNotification('Session check failed', 'warning');
    }
}

async function checkSubscriptionStatus() {
    try {
        const { data: profiles, error } = await supabaseClient
            .from('profiles')
            .select('subscription_status, subscription_end_date')
            .eq('id', currentUser.id);

        if (!error && profiles && profiles.length > 0) {
            const profile = profiles[0];
            userSubscription = {
                status: profile.subscription_status,
                endDate: profile.subscription_end_date
            };

            // Show premium content if subscribed
            if (profile.subscription_status === 'premium') {
                showPremiumContent();
            }
        }
    } catch (error) {
        console.error('Error checking subscription:', error);
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

        // Show edit routine section if user is logged in
        const editRoutineSection = document.getElementById('editRoutineSection');
        if (editRoutineSection) {
            editRoutineSection.style.display = 'block';
        }
    } else {
        authButtons.style.display = 'flex';
        profileContainer.style.display = 'none';
    }
}

// Audio Player Functions
function setupAudioPlayers() {
    const audioElements = document.querySelectorAll('.audio-element');

    audioElements.forEach(audio => {
        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('ended', onAudioEnded);
        audio.addEventListener('loadedmetadata', updateDuration);
    });
}

function toggleAudio(button, trackName) {
    const mediaPlayer = button.closest('.media-player');
    const audio = mediaPlayer.querySelector('.audio-element');

    // Get track name from data attribute if not provided
    if (!trackName || typeof trackName !== 'string') {
        trackName = mediaPlayer.dataset.track || mediaPlayer.querySelector('h4')?.textContent || 'unknown-track';
    }

    // Ensure trackName is a string
    trackName = String(trackName).replace(/[^a-zA-Z0-9\s]/g, '').trim();

    if (currentlyPlaying && currentlyPlaying !== audio) {
        currentlyPlaying.pause();
        resetAudioUI(currentlyPlaying);
    }

    if (audio.paused) {
        audio.play().catch(error => {
            console.log('Audio play failed:', error);
            showNotification('Audio playback not available in preview', 'info');
        });
        button.innerHTML = '⏸';
        button.style.background = '#8b4513';
        currentlyPlaying = audio;

        // Track in Supabase
        if (trackName && typeof trackName === 'string') {
            trackAudioProgress(trackName, 'started');
            showNotification(`Now playing: ${trackName.charAt(0).toUpperCase() + trackName.slice(1)}`, 'info');
        }
    } else {
        audio.pause();
        button.innerHTML = '▶';
        button.style.background = '#d4af37';
        currentlyPlaying = null;

        // Track pause in Supabase
        if (trackName && typeof trackName === 'string') {
            trackAudioProgress(trackName, 'paused', audio.currentTime);
        }
    }
}

function updateProgress(event) {
    const audio = event.target;
    const mediaPlayer = audio.closest('.media-player');
    const progressFill = mediaPlayer.querySelector('.progress-fill');
    const timeDisplay = mediaPlayer.querySelector('.time-display');

    const progress = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = progress + '%';

    const currentTime = formatTime(audio.currentTime);
    const duration = formatTime(audio.duration);
    timeDisplay.textContent = `${currentTime} / ${duration}`;
}

function updateDuration(event) {
    const audio = event.target;
    const mediaPlayer = audio.closest('.media-player');
    const timeDisplay = mediaPlayer.querySelector('.time-display');

    const duration = formatTime(audio.duration);
    timeDisplay.textContent = `0:00 / ${duration}`;
}

function onAudioEnded(event) {
    const audio = event.target;
    const mediaPlayer = audio.closest('.media-player');
    const playButton = mediaPlayer.querySelector('.play-button');

    resetAudioUI(audio);
    const trackName = mediaPlayer.dataset.track;
    if (trackName) {
        trackAudioProgress(trackName, 'completed', audio.duration);
        showNotification(`Completed: ${trackName.charAt(0).toUpperCase() + trackName.slice(1)}`, 'success');
    }
}

function resetAudioUI(audio) {
    const mediaPlayer = audio.closest('.media-player');
    const playButton = mediaPlayer.querySelector('.play-button');
    const progressFill = mediaPlayer.querySelector('.progress-fill');

    playButton.innerHTML = '▶';
    playButton.style.background = '#d4af37';
    progressFill.style.width = '0%';
    currentlyPlaying = null;
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

async function trackAudioProgress(trackName, action, currentTime = 0) {
    if (!currentUser || !supabaseClient) return;

    try {
        const progressUpdate = {
            user_id: currentUser.id,
            track_name: trackName,
            action: action,
            current_time: currentTime,
            timestamp: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from('audio_progress')
            .insert([progressUpdate]);

        if (error) throw error;
    } catch (error) {
        console.error('Error tracking audio progress:', error);
    }
}

function downloadAudio(trackName) {
    if (!currentUser) {
        showNotification('Please log in to download audio files', 'warning');
        return;
    }

    // Ensure trackName is a string
    const safeTrackName = String(trackName || 'unknown-track');

    // In a real app, this would download the actual audio file
    const link = document.createElement('a');
    link.href = `https://example.com/audio/${safeTrackName}.mp3`;
    link.download = `${safeTrackName}.mp3`;
    link.click();

    showNotification(`Downloading: ${safeTrackName}`, 'success');
    trackAudioProgress(safeTrackName, 'downloaded');
}

function downloadVideo(videoName) {
    if (!currentUser) {
        showNotification('Please log in to download video files', 'warning');
        return;
    }

    // Ensure videoName is a string
    const safeVideoName = String(videoName || 'unknown-video');

    // In a real app, this would download the actual video file
    const link = document.createElement('a');
    link.href = `https://example.com/video/${safeVideoName}.mp4`;
    link.download = `${safeVideoName}.mp4`;
    link.click();

    showNotification(`Downloading: ${safeVideoName}`, 'success');
    trackVideoProgress(safeVideoName, 'downloaded');
}

// Video Player Functions
function playVideo(videoName) {
    showNotification(`🎬 Loading video: ${videoName.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`, 'info');

    if (currentUser) {
        trackVideoProgress(videoName, 'started');
    }
}

function playPremiumVideo(videoName) {
    if (!currentUser) {
        showNotification('Please log in to access premium content', 'warning');
        return;
    }

    if (userSubscription?.status !== 'premium') {
        showPremiumModal();
        return;
    }

    showNotification(`🎬 Loading premium video: ${videoName}`, 'info');
    trackVideoProgress(videoName, 'started');
}

async function trackVideoProgress(videoName, action, currentTime = 0) {
    if (!currentUser || !supabaseClient) return;

    try {
        const progressUpdate = {
            user_id: currentUser.id,
            video_name: videoName,
            action: action,
            current_time: currentTime,
            timestamp: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from('video_progress')
            .insert([progressUpdate]);

        if (error) throw error;
    } catch (error) {
        console.error('Error tracking video progress:', error);
    }
}

// Premium Subscription Functions
function showPremiumModal() {
    if (!currentUser) {
        showNotification('Please log in first to subscribe', 'warning');
        showAuthModal('login');
        return;
    }

    const premiumModal = document.getElementById('premiumModal');
    premiumModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePremiumModal() {
    const premiumModal = document.getElementById('premiumModal');
    premiumModal.classList.remove('active');
    document.body.style.overflow = '';
}

async function processPremiumSubscription() {
    const paymentMethod = document.getElementById('paymentMethod').value;

    try {
        // In a real app, you would integrate with Stripe, PayPal, etc.
        showNotification('Processing payment...', 'info');

        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update user subscription in Supabase
        const { error } = await supabaseClient
            .from('profiles')
            .update({
                subscription_status: 'premium',
                subscription_start_date: new Date().toISOString(),
                subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
                payment_method: paymentMethod
            })
            .eq('id', currentUser.id);

        if (error) throw error;

        userSubscription = {
            status: 'premium',
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };

        showPremiumContent();
        closePremiumModal();
        showNotification('🎉 Welcome to Premium! You now have access to all exclusive content and your personal coach!', 'success');

    } catch (error) {
        console.error('Payment error:', error);
        showNotification('Payment failed. Please try again.', 'error');
    }
}

function showPremiumContent() {
    const premiumVideos = document.getElementById('premiumVideos');
    if (premiumVideos) {
        premiumVideos.style.display = 'block';
    }

    // Remove locked overlays
    document.querySelectorAll('.locked-content').forEach(element => {
        element.classList.remove('locked-content');
    });
}

// Routine Management Functions
function selectBlock(element, time) {
    if (!currentUser) {
        showNotification('Please log in to customize your routine', 'warning');
        return;
    }

    if (editingMode) {
        currentEditingBlock = element;
        showTimeEditor(time);
        return;
    }

    element.classList.toggle('selected');

    if (element.classList.contains('selected')) {
        showNotification(`✅ Added ${time} to your routine!`, 'success');
    } else {
        showNotification(`❌ Removed ${time} from your routine`, 'warning');
    }
}

function enableTimeEditing() {
    if (!currentUser) {
        showNotification('Please log in to edit your routine', 'warning');
        return;
    }

    editingMode = !editingMode;
    const timeBlocks = document.querySelectorAll('.time-block');

    if (editingMode) {
        timeBlocks.forEach(block => {
            block.classList.add('editable');
        });
        document.body.classList.add('editing-mode');
        showNotification('Click on any time block to edit it', 'info');
    } else {
        timeBlocks.forEach(block => {
            block.classList.remove('editable');
        });
        document.body.classList.remove('editing-mode');
        showNotification('Editing mode disabled', 'info');
    }
}

function showTimeEditor(originalTime) {
    const timeEditorModal = document.getElementById('timeEditorModal');
    timeEditorModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Pre-fill with current values if available
    if (originalTime) {
        const times = originalTime.split(' - ');
        if (times.length === 2) {
            document.getElementById('startTime').value = convertTo24Hour(times[0]);
            document.getElementById('endTime').value = convertTo24Hour(times[1]);
        }
    }
}

function closeTimeEditor() {
    const timeEditorModal = document.getElementById('timeEditorModal');
    timeEditorModal.classList.remove('active');
    document.body.style.overflow = '';
    currentEditingBlock = null;
}

async function saveTimeEdit() {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const activityName = document.getElementById('activityName').value;
    const activityDescription = document.getElementById('activityDescription').value;

    if (!startTime || !endTime || !activityName) {
        showNotification('Please fill in all required fields', 'warning');
        return;
    }

    try {
        const routineItem = {
            user_id: currentUser.id,
            start_time: startTime,
            end_time: endTime,
            activity_name: activityName,
            activity_description: activityDescription,
            created_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from('user_routines')
            .insert([routineItem]);

        if (error) throw error;

        // Update the UI
        if (currentEditingBlock) {
            currentEditingBlock.innerHTML = `
                <h4>${startTime} - ${endTime}</h4>
                <p>${activityName}</p>
                <small>${activityDescription}</small>
            `;
        }

        closeTimeEditor();
        showNotification('Time block updated successfully!', 'success');

    } catch (error) {
        console.error('Error saving routine:', error);
        showNotification('Error saving time block', 'error');
    }
}

function convertTo24Hour(time12h) {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');

    if (hours === '12') {
        hours = '00';
    }

    if (modifier === 'PM') {
        hours = parseInt(hours, 10) + 12;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

async function saveRoutine() {
    if (!currentUser) {
        showNotification('Please log in to save your routine', 'warning');
        return;
    }

    const selectedBlocks = document.querySelectorAll('.time-block.selected');
    if (selectedBlocks.length === 0) {
        showNotification('🎯 Select some time blocks first to create your routine!', 'warning');
        return;
    }

    try {
        // Save routine completion in progress tracking
        await updateDailyProgress('routine_created', true);
        showNotification(`🏆 Routine Saved! You've selected ${selectedBlocks.length} time blocks.`, 'success');

    } catch (error) {
        console.error('Error saving routine:', error);
        showNotification('Error saving routine', 'error');
    }
}

// Progress Tracking Functions
async function updateDailyProgress(habitName, completed) {
    if (!currentUser || !supabaseClient) return;

    try {
        const today = new Date().toISOString().split('T')[0];

        const { data: existing, error: fetchError } = await supabaseClient
            .from('daily_progress')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('date', today)
            .single();

        const progressData = {
            user_id: currentUser.id,
            date: today,
            [habitName]: completed,
            updated_at: new Date().toISOString()
        };

        if (existing) {
            const { error } = await supabaseClient
                .from('daily_progress')
                .update(progressData)
                .eq('id', existing.id);

            if (error) throw error;
        } else {


// Notification System Functions
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
        
        // Start polling for new notifications
        if (notificationInterval) clearInterval(notificationInterval);
        notificationInterval = setInterval(pollForNewNotifications, 30000); // Check every 30 seconds
        
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

async function pollForNewNotifications() {
    if (!currentUser || !supabaseClient) return;

    try {
        const lastCheck = userNotifications.length > 0 ? userNotifications[0].created_at : new Date(0).toISOString();
        
        const { data: newNotifications, error } = await supabaseClient
            .from('user_notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .gt('created_at', lastCheck)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (newNotifications && newNotifications.length > 0) {
            userNotifications = [...newNotifications, ...userNotifications];
            updateNotificationUI();
            
            // Show toast notification for new messages
            showNotification(`You have ${newNotifications.length} new notification(s)`, 'info');
        }
    } catch (error) {
        console.error('Error polling for notifications:', error);
    }
}

async function addWelcomeNotification() {
    if (!currentUser || !supabaseClient) return;

    try {
        // Check if user already has a welcome notification
        const { data: existingWelcome, error: checkError } = await supabaseClient
            .from('user_notifications')
            .select('id')
            .eq('user_id', currentUser.id)
            .ilike('message', '%Welcome to MindCraft Academy%');

        if (checkError) throw checkError;

        if (!existingWelcome || existingWelcome.length === 0) {
            // Add welcome notification
            const welcomeNotification = {
                user_id: currentUser.id,
                message: `🎉 Welcome to MindCraft Academy! We're excited to have you on your transformation journey. Check out our audio library and start building your perfect daily routine.`,
                type: 'success',
                is_read: false,
                created_at: new Date().toISOString()
            };

            const { error: insertError } = await supabaseClient
                .from('user_notifications')
                .insert([welcomeNotification]);

            if (insertError) throw insertError;

            // Reload notifications to include the welcome message
            await loadUserNotifications();
        }
    } catch (error) {
        console.error('Error adding welcome notification:', error);
    }
}

function updateNotificationUI() {
    const bell = document.getElementById('notificationBell');
    const badge = document.getElementById('notificationBadge');
    const notificationsList = document.getElementById('notificationsList');

    if (!bell || !currentUser) {
        if (bell) bell.style.display = 'none';
        return;
    }

    // Show notification bell when user is logged in
    bell.style.display = 'flex';

    // Update badge
    const unreadCount = userNotifications.filter(n => !n.is_read).length;
    if (unreadCount > 0) {
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }

    // Update notifications list
    if (notificationsList) {
        if (userNotifications.length === 0) {
            notificationsList.innerHTML = '<div class="no-notifications">No notifications yet</div>';
        } else {
            notificationsList.innerHTML = userNotifications.map(notification => `
                <div class="notification-item ${notification.is_read ? '' : 'unread'}" onclick="markAsRead('${notification.id}')">
                    <div class="notification-content">
                        <span class="notification-icon">${getNotificationIcon(notification.type)}</span>
                        <div>
                            <div class="notification-text">${notification.message}</div>
                            <div class="notification-time">${formatNotificationTime(notification.created_at)}</div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }
}

function toggleNotifications(event) {
    if (event) event.stopPropagation();
    
    const dropdown = document.getElementById('notificationDropdown');
    dropdown.classList.toggle('active');
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

        // Update local state
        const notification = userNotifications.find(n => n.id === notificationId);
        if (notification) {
            notification.is_read = true;
            updateNotificationUI();
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllAsRead() {
    if (!currentUser || !supabaseClient) return;

    try {
        const unreadIds = userNotifications.filter(n => !n.is_read).map(n => n.id);
        
        if (unreadIds.length === 0) return;

        const { error } = await supabaseClient
            .from('user_notifications')
            .update({ is_read: true })
            .in('id', unreadIds)
            .eq('user_id', currentUser.id);

        if (error) throw error;

        // Update local state
        userNotifications.forEach(notification => {
            notification.is_read = true;
        });
        
        updateNotificationUI();
        showNotification('All notifications marked as read', 'success');
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

function formatNotificationTime(timestamp) {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - notificationTime) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;
    
    return notificationTime.toLocaleDateString();
}

// Close notification dropdown when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('notificationDropdown');
    const bell = document.getElementById('notificationBell');
    
    if (dropdown && bell && !bell.contains(event.target)) {
        dropdown.classList.remove('active');
    }
});

            const { error } = await supabaseClient
                .from('daily_progress')
                .insert([progressData]);

            if (error) throw error;
        }

        // Update streak if applicable
        await updateStreak();

    } catch (error) {
        console.error('Error updating progress:', error);
    }
}

async function updateStreak() {
    if (!currentUser) return;

    try {
        // Calculate current streak
        const { data: recentProgress, error } = await supabaseClient
            .from('daily_progress')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('date', { ascending: false })
            .limit(30);

        if (error) throw error;

        let currentStreak = 0;
        const today = new Date().toISOString().split('T')[0];

        for (const day of recentProgress) {
            const hasCompletions = Object.values(day).some(value => 
                typeof value === 'boolean' && value === true
            );

            if (hasCompletions) {
                currentStreak++;
            } else {
                break;
            }
        }

        // Update user progress with new streak
        const { error: updateError } = await supabaseClient
            .from('user_progress')
            .update({
                current_streak: currentStreak,
                last_updated: new Date().toISOString()
            })
            .eq('user_id', currentUser.id);

        if (updateError) throw updateError;

        userProgress.current_streak = currentStreak;

    } catch (error) {
        console.error('Error updating streak:', error);
    }
}

function updateProgress() {
    if (!currentUser) {
        showNotification('Please log in to track progress', 'warning');
        return;
    }

    updateDailyProgress('manual_update', true);
    showNotification('📈 Progress Updated! Keep building momentum!', 'success');
}

// Authentication Functions
function showAuthModal(type) {
    const authModal = document.getElementById('authModal');
    const formTitle = document.getElementById('formTitle');
    const submitButton = document.getElementById('submitButton');
    const formFooter = document.getElementById('formFooter');
    const nameGroup = document.getElementById('nameGroup');
    const authForm = document.getElementById('authForm');
    const passwordGroup = document.querySelector('#password').parentElement;

    authModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Reset visibility for all form groups
    nameGroup.style.display = 'none';
    passwordGroup.style.display = 'block';

    if (type === 'login') {
        formTitle.textContent = 'Welcome Back';
        submitButton.textContent = 'Sign In';
        formFooter.innerHTML = `
            Don't have an account? <a onclick="toggleForm('signup')">Sign up</a><br>
            <a onclick="showForgotPasswordModal()" style="font-size: 0.9rem; color: #8b4513; margin-top: 10px; display: block;">Forgot your password?</a>
        `;
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
                    },
                    emailRedirectTo: `${window.location.origin}/email-confirmed`
                }
            });

            if (error) {
                showNotification(error.message, 'error');
                return;
            }

            if (data.user) {
                closeAuthModal();
                showEmailConfirmationNotification(email);
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
                // Check if email is confirmed
                if (!data.user.email_confirmed_at) {
                    showNotification('Please check your email and confirm your account before logging in.', 'warning');
                    return;
                }

                currentUser = data.user;
                
                // Load or create user profile
                await loadOrCreateUserProfile();
                
                updateUserInterface();
                closeAuthModal();
                
                // Load user notifications and data
                await loadUserNotifications();
                await addWelcomeNotification();
                
                showNotification(`Welcome back!`, 'success');
            }
        } else if (formType === 'forgot-password') {
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
            });

            if (error) {
                showNotification(error.message, 'error');
                return;
            }

            closeAuthModal();
            showNotification('Password reset email sent! Check your inbox.', 'success');
        } else if (formType === 'reset-password') {
            const newPassword = password;
            const { error } = await supabaseClient.auth.updateUser({
                password: newPassword
            });

            if (error) {
                showNotification(error.message, 'error');
                return;
            }

            showNotification('Password updated successfully! You can now log in with your new password.', 'success');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        }
    } catch (error) {
        console.error('Auth error:', error);
        showNotification('Authentication failed. Please try again.', 'error');
    } finally {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

function showEmailConfirmationNotification(email) {
    const notification = document.createElement('div');
    notification.className = 'email-confirmation-notification';
    notification.innerHTML = `
        <div class="email-confirmation-content">
            <div class="email-confirmation-icon">📧</div>
            <h3>Check Your Email!</h3>
            <p>We've sent a confirmation link to:</p>
            <p class="email-address">${email}</p>
            <p>Click the link in your email to activate your account and start your transformation journey!</p>
            <div class="email-confirmation-actions">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="email-confirm-btn">Got it!</button>
                <button onclick="resendConfirmationEmail('${email}')" class="resend-email-btn">Resend Email</button>
            </div>
        </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 100);
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

function showForgotPasswordModal() {
    const authModal = document.getElementById('authModal');
    const formTitle = document.getElementById('formTitle');
    const submitButton = document.getElementById('submitButton');
    const formFooter = document.getElementById('formFooter');
    const nameGroup = document.getElementById('nameGroup');
    const authForm = document.getElementById('authForm');
    const passwordGroup = document.querySelector('#password').parentElement;

    authModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    formTitle.textContent = 'Reset Your Password';
    submitButton.textContent = 'Send Reset Email';
    formFooter.innerHTML = 'Remember your password? <a onclick="toggleForm(\'login\')">Sign in</a>';
    nameGroup.style.display = 'none';
    passwordGroup.style.display = 'none';
    authForm.dataset.type = 'forgot-password';
}

async function loadOrCreateUserProfile() {
    if (!currentUser) return;

    try {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        if (!profile) {
            // Create profile if it doesn't exist
            console.log('No profile found, creating new profile...');
            await createUserProfile(
                currentUser.user_metadata?.name || currentUser.email?.split('@')[0],
                currentUser.email
            );
        } else {
            console.log('Existing profile loaded:', profile);
        }

        // Initialize other user data
        await initializeUserTables();
    } catch (error) {
        console.error('Error loading/creating profile:', error);
        showNotification('Failed to load profile: ' + error.message, 'error');
    }
}

async function createUserProfile(name, email) {
    if (!currentUser) return;

    try {
        // First check if profile already exists
        const { data: existingProfile, error: checkError } = await supabaseClient
            .from('profiles')
            .select('id')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
        }

        if (existingProfile) {
            console.log('Profile already exists for user:', currentUser.id);
            return;
        }

        // Create new profile
        const { error } = await supabaseClient
            .from('profiles')
            .insert([
                {
                    id: currentUser.id,
                    email: email,
                    name: name || email.split('@')[0],
                    created_at: new Date().toISOString(),
                    subscription_status: 'free',
                    join_date: new Date().toISOString()
                }
            ]);

        if (error) {
            throw error;
        }

        console.log('New profile created for user:', currentUser.id);
        showNotification('Profile created successfully!', 'success');
    } catch (error) {
        console.error('Error creating profile:', error);
        showNotification('Failed to create profile: ' + error.message, 'error');
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
        userSubscription = null;
        userProgress = null;
        userRoutine = [];
        userNotifications = [];
        
        // Clear notification polling
        if (notificationInterval) {
            clearInterval(notificationInterval);
            notificationInterval = null;
        }
        
        updateUserInterface();
        updateNotificationUI();
        showNotification('You have been signed out successfully', 'success');

        const profileMenu = document.getElementById('profileMenu');
        profileMenu.classList.remove('active');

        // Hide premium content
        const premiumVideos = document.getElementById('premiumVideos');
        if (premiumVideos) {
            premiumVideos.style.display = 'none';
        }

    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Logout failed. Please try again.', 'error');
    }
}

// Notification System
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

// Tab Management
function showTab(tabName) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));

    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));

    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}

// Newsletter Functions
function subscribeNewsletter(event) {
    event.preventDefault();
    const email = event.target.querySelector('.email-input').value;

    if (email) {
        showNotification(`🎉 Welcome to the MindCraft Community! Check your email for the bonus guide.`, 'success');
        event.target.querySelector('.email-input').value = '';
    }
}

// Profile Menu Toggle
document.addEventListener('DOMContentLoaded', function() {
    const profileContainer = document.getElementById('profileContainer');
    const profileMenu = document.getElementById('profileMenu');

    if (profileContainer) {
        profileContainer.addEventListener('click', function(e) {
            e.stopPropagation();
            profileMenu.classList.toggle('active');
        });
    }

    document.addEventListener('click', function() {
        if (profileMenu) {
            profileMenu.classList.remove('active');
        }
    });
});