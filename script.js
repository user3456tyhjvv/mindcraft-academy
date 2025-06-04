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

                try {
                    await loadOrCreateUserProfile();
                    updateUserInterface();

                    // Load user notifications and data
                    await loadUserNotifications();
                    await addWelcomeNotification();

                    const userName = currentUser.user_metadata?.name || currentUser.email?.split('@')[0];
                    showNotification(`🎉 Email confirmed! Welcome to MindCraft Academy, ${userName}!`, 'success');

                    // Clean up URL and redirect to main page
                    window.history.replaceState({}, document.title, '/');
                } catch (profileError) {
                    console.error('Profile creation error after confirmation:', profileError);
                    showNotification('⚠️ Email confirmed but there was an issue setting up your profile. Please try logging in.', 'warning');

                    // Still clean up URL
                    window.history.replaceState({}, document.title, '/');
                }
            }
        } catch (error) {
            console.error('Email confirmation error:', error);
            showNotification('❌ Email confirmation failed. Please try logging in or contact support.', 'error');
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
    if (!supabaseClient || !currentUser) {
        console.error('Supabase client or current user not available');
        return;
    }

    try {
        console.log('Initializing user tables for:', currentUser.id);

        // Ensure profile exists (this will create it if needed)
        await loadOrCreateUserProfile();

        // Initialize progress tracking
        await initializeUserProgress();

        // Load user routine
        await loadUserRoutine();

        console.log('User tables initialized successfully');

    } catch (error) {
        console.error('Error initializing user tables:', error);
        showNotification('Error setting up user data: ' + error.message, 'error');
        throw error;
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
            console.log('User session found:', currentUser.id);

            try {
                // Initialize user data with better error handling
                await initializeUserTables();
                updateUserInterface();

                // Load notifications without blocking
                loadUserNotifications().catch(err => console.warn('Failed to load notifications:', err));
                addWelcomeNotification().catch(err => console.warn('Failed to add welcome notification:', err));

                const userName = currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'User';
                showNotification(`Welcome back, ${userName}!`, 'success');

                // Check subscription status
                checkSubscriptionStatus().catch(err => console.warn('Failed to check subscription:', err));
            } catch (error) {
                console.error('Error initializing user data:', error);
                // Still update UI even if some initialization fails
                updateUserInterface();
                showNotification('Logged in with limited functionality', 'warning');
            }
        }
    } catch (error) {
        console.error('Error checking session:', error);
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

    // Check if this is an edit click
    if (element.querySelector('.edit-time-btn')) {
        return; // Let the edit button handle this
    }

    element.classList.toggle('selected');

    if (element.classList.contains('selected')) {
        showNotification(`✅ Added ${time} to your routine!`, 'success');
        trackRoutineChange('added', time);
    } else {
        showNotification(`❌ Removed ${time} from your routine`, 'warning');
        trackRoutineChange('removed', time);
    }
}

function showEditTimeModal(timeBlock, originalTime) {
    if (!currentUser) {
        showNotification('Please log in to edit your routine', 'warning');
        return;
    }

    currentEditingBlock = timeBlock;
    const modal = document.getElementById('editTimeModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Pre-fill form with current values
        const timeRange = originalTime.split(' - ');
        if (timeRange.length === 2) {
            document.getElementById('editStartTime').value = convertTo24Hour(timeRange[0]);
            document.getElementById('editEndTime').value = convertTo24Hour(timeRange[1]);
        }

        const currentActivity = timeBlock.querySelector('p').textContent;
        const currentDescription = timeBlock.querySelector('small').textContent;

        document.getElementById('editActivityName').value = currentActivity.replace(/[^\w\s]/gi, '');
        document.getElementById('editActivityDescription').value = currentDescription;
    }
}

function closeEditTimeModal() {
    const modal = document.getElementById('editTimeModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
    currentEditingBlock = null;
}

async function saveEditedTime() {
    const startTime = document.getElementById('editStartTime').value;
    const endTime = document.getElementById('editEndTime').value;
    const activityName = document.getElementById('editActivityName').value;
    const activityDescription = document.getElementById('editActivityDescription').value;

    if (!startTime || !endTime || !activityName) {
        showNotification('Please fill in all required fields', 'warning');
        return;
    }

    try {
        if (currentEditingBlock && supabaseClient && currentUser) {
            // Save to database
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
                .upsert([routineItem], { onConflict: 'user_id,start_time' });

            if (error) throw error;
        }

        // Update UI
        if (currentEditingBlock) {
            const timeFormatted = `${convertTo12Hour(startTime)} - ${convertTo12Hour(endTime)}`;
            currentEditingBlock.innerHTML = `
                <h4>${timeFormatted}</h4>
                <p>${activityName}</p>
                <small>${activityDescription}</small>
                <button class="edit-time-btn" onclick="showEditTimeModal(this.parentElement, '${timeFormatted}')">✏️ Edit</button>
            `;
        }

        closeEditTimeModal();
        showNotification('⏰ Time block updated successfully!', 'success');

        // Add notification
        await addUserNotification(`✅ Routine updated: ${activityName} scheduled for ${convertTo12Hour(startTime)} - ${convertTo12Hour(endTime)}`, 'success');

    } catch (error) {
        console.error('Error saving routine:', error);
        showNotification('Error saving time block', 'error');
    }
}

function convertTo12Hour(time24) {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${period}`;
}

async function trackRoutineChange(action, time) {
    if (!currentUser || !supabaseClient) return;

    try {
        await addUserNotification(`📅 Routine ${action}: ${time}`, 'info');
        await updateDailyProgress('routine_created', true);
    } catch (error) {
        console.error('Error tracking routine change:', error);
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
            const { error } = await supabaseClient
                .from('daily_progress')
                .insert([progressData]);

            if (error) throw error;
        }

        // Update streak and show recommendations
        await updateStreak();
        await showPersonalizedRecommendations(habitName, completed);

    } catch (error) {
        console.error('Error updating progress:', error);
    }
}

async function showPersonalizedRecommendations(habitName, completed) {
    if (!currentUser) return;

    const recommendations = {
        routine_created: {
            completed: "🎯 Great routine! Try adding a 5-minute meditation block for better focus.",
            incomplete: "⏰ No routine yet? Start with just 3 time blocks - morning, work, and evening."
        },
        audio_listened: {
            completed: "🎧 Excellent! Consider taking notes while listening to retain more insights.",
            incomplete: "📚 Try listening during commute or exercise for maximum efficiency."
        },
        video_watched: {
            completed: "📺 Great learning! Apply one concept from the video today.",
            incomplete: "🎬 Even 10 minutes of learning daily compounds into massive growth."
        },
        exercise_completed: {
            completed: "💪 Well done! Your brain is now primed for peak performance.",
            incomplete: "🏃‍♂️ Even a 10-minute walk boosts creativity and reduces anxiety."
        },
        meditation_done: {
            completed: "🧘‍♀️ Mindful! This practice strengthens your focus for everything else.",
            incomplete: "🌱 Start with 3 deep breaths. Consistency beats duration."
        },
        reading_done: {
            completed: "📖 Knowledge gained! Consider sharing one insight with someone.",
            incomplete: "📚 Reading 1 page daily = 365 pages yearly. Small steps, big results."
        }
    };

    const recommendation = recommendations[habitName];
    if (recommendation) {
        const message = completed ? recommendation.completed : recommendation.incomplete;
        await addUserNotification(message, 'info');
    }
}

function showProgressCustomization() {
    if (!currentUser) {
        showNotification('Please log in to customize your progress tracking', 'warning');
        return;
    }

    const modal = document.getElementById('progressCustomModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeProgressCustomModal() {
    const modal = document.getElementById('progressCustomModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

async function saveProgressCustomization() {
    if (!currentUser || !supabaseClient) return;

    try {
        const customHabits = [];
        const habitInputs = document.querySelectorAll('.custom-habit-input');

        habitInputs.forEach(input => {
            if (input.value.trim()) {
                customHabits.push({
                    name: input.value.trim(),
                    target: input.dataset.target || 1,
                    category: input.dataset.category || 'personal'
                });
            }
        });

        // Save custom habits to user profile```text

        const { error } = await supabaseClient
            .from('profiles')
            .update({
                custom_habits: customHabits,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);

        if (error) throw error;

        closeProgressCustomModal();
        showNotification('✨ Progress tracking customized successfully!', 'success');
        await addUserNotification('🎯 Your personalized progress tracking is now active!', 'success');

        // Refresh progress display
        loadCustomProgressTracking();

    } catch (error) {
        console.error('Error saving progress customization:', error);
        showNotification('Error saving customization', 'error');
    }
}

async function loadCustomProgressTracking() {
    if (!currentUser || !supabaseClient) return;

    try {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('custom_habits')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;

        if (profile && profile.custom_habits) {
            updateProgressTrackingUI(profile.custom_habits);
        }
    } catch (error) {
        console.error('Error loading custom progress tracking:', error);
    }
}

function updateProgressTrackingUI(customHabits) {
    const habitTracker = document.querySelector('.habit-tracker');
    if (!habitTracker) return;

    // Add custom habits to the tracking display
    customHabits.forEach(habit => {
        const habitItem = document.createElement('div');
        habitItem.className = 'habit-item custom-habit';
        habitItem.innerHTML = `
            <div class="habit-name">🎯 ${habit.name}</div>
            <div class="habit-progress">
                <div class="habit-progress-fill" style="width: 0%"></div>
            </div>
            <small style="color: #5d4e37; margin-top: 5px; display: block;">Custom goal • Track daily progress</small>
            <button class="update-custom-btn" onclick="updateCustomHabit('${habit.name}')">Mark Complete</button>
        `;
        habitTracker.appendChild(habitItem);
    });
}

async function updateCustomHabit(habitName) {
    if (!currentUser) return;

    const habitItem = event.target.closest('.custom-habit');
    const progressFill = habitItem.querySelector('.habit-progress-fill');
    const button = event.target;

    // Toggle completion
    const isCompleted = progressFill.style.width === '100%';
    progressFill.style.width = isCompleted ? '0%' : '100%';
    button.textContent = isCompleted ? 'Mark Complete' : 'Completed ✓';
    button.style.background = isCompleted ? '#d4af37' : '#10b981';

    if (!isCompleted) {
        showNotification(`✅ ${habitName} completed!`, 'success');
        await addUserNotification(`🎯 Custom habit completed: ${habitName}`, 'success');
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
                <a onclick="showForgotPasswordModal()" style="font-size: 0.9rem; color: #8b4513; margin-top: 10px; display: block; cursor: pointer; text-decoration: underline;">Forgot your password?</a>
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
                    emailRedirectTo: `${window.location.origin}/`
                }
            });

            if (error) {
                showStyledNotification('❌ Signup Failed', `Registration failed: ${error.message}`, 'error');
                return;
            }

            if (data.user && !data.user.identities?.length) {
                // User already exists
                showStyledNotification('⚠️ Account Exists', 'An account with this email already exists. Please try logging in instead.', 'warning');
                return;
            }

            if (data.user) {
                closeAuthModal();

                // Show beautiful email confirmation notification
                showStyledEmailConfirmationNotification(email, name);

                // Also show a quick success notification
                showStyledNotification('🎉 Account Created!', 'Please check your email to confirm your account and start your journey.', 'success');

                // Track signup in Supabase notifications table
                try {
                    const { error: notifError } = await supabaseClient
                        .from('user_notifications')
                        .insert([{
                            user_id: data.user.id,
                            message: `🎉 Welcome to MindCraft Academy! Please confirm your email to unlock all features.`,
                            type: 'info',
                            is_read: false,
                            created_at: new Date().toISOString()
                        }]);

                    if (notifError) console.warn('Failed to create welcome notification:', notifError);
                } catch (err) {
                    console.warn('Error creating signup notification:', err);
                }

            } else {
                showStyledNotification('❌ Error', 'Signup failed. Please try again.', 'error');
            }
        } else if (formType === 'login') {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    showNotification('❌ Invalid email or password. Please check your credentials and try again.', 'error');
                } else if (error.message.includes('Email not confirmed')) {
                    showNotification('⚠️ Please check your email and confirm your account before logging in.', 'warning');
                } else {
                    showNotification(`❌ Login failed: ${error.message}`, 'error');
                }
                return;
            }

            if (data.user) {
                // Check if email is confirmed
                if (!data.user.email_confirmed_at) {
                    showNotification('⚠️ Please check your email and confirm your account before logging in.', 'warning');

                    // Offer to resend confirmation email
                    const resendConfirm = confirm('Would you like us to resend the confirmation email?');
                    if (resendConfirm) {
                        try {
                            await supabaseClient.auth.resend({
                                type: 'signup',
                                email: email,
                                options: {
                                    emailRedirectTo: `${window.location.origin}/email-confirmed.html`
                                }
                            });
                            showNotification('📧 Confirmation email resent! Please check your inbox.', 'success');
                        } catch (resendError) {
                            showNotification('Failed to resend confirmation email.', 'error');
                        }
                    }
                    return;
                }

                currentUser = data.user;

                try {
                    // Load or create user profile
                    await loadOrCreateUserProfile();

                    updateUserInterface();
                    closeAuthModal();

                    // Initialize all user systems
                    await initializeUserSystems();

                    const userName = currentUser.user_metadata?.name || currentUser.email?.split('@')[0];
                    showStyledNotification('🎉 Welcome Back!', `Great to see you again, ${userName}! Your progress is ready to continue.`, 'success');

                    // Show progress summary
                    setTimeout(() => {
                        showProgressSummary();
                    }, 2000);

                } catch (profileError) {
                    console.error('Profile loading error:', profileError);
                    showStyledNotification('⚠️ Login Issue', 'Login successful but there was an issue loading your profile. Some features may be limited.', 'warning');
                }
            } else {
                showNotification('❌ Login failed. Please try again.', 'error');
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
    if (!currentUser) {
        console.error('No current user available');
        return;
    }

    try {
        console.log('Loading profile for user:', currentUser.id);

        // First, try to get existing profile with retries
        for (let attempt = 0; attempt < 3; attempt++) {
            const { data: existingProfile, error: selectError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', currentUser.id)
                .maybeSingle();

            if (selectError && selectError.code !== 'PGRST116') {
                console.error('Error fetching profile:', selectError);
                if (attempt === 2) throw selectError;
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            if (existingProfile) {
                console.log('Profile found:', existingProfile);
                return existingProfile;
            }

            // Profile doesn't exist, try to create it
            console.log('No profile found, creating new profile...');

            const profileData = {
                id: currentUser.id,
                email: currentUser.email,
                name: currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'User',
                subscription_status: 'free',
                totp_enabled: false
            };

            console.log('Creating profile with data:', profileData);

            const { data: newProfile, error: createError } = await supabaseClient
                .from('profiles')
                .upsert([profileData], { 
                    onConflict: 'id',
                    ignoreDuplicates: false 
                })
                .select()
                .single();

            if (createError) {
                console.error('Profile creation error:', createError);
                if (attempt === 2) {
                    throw new Error(`Failed to create profile: ${createError.message}`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            console.log('Profile created/updated successfully:', newProfile);
            return newProfile;
        }

        throw new Error('Failed to load or create profile after 3 attempts');

    } catch (error) {
        console.error('Error in loadOrCreateUserProfile:', error);

        // Don't show error notification for profile issues, just log
        console.warn('Profile creation failed, continuing with limited functionality');

        // Return a basic profile object to prevent further errors
        return {
            id: currentUser.id,
            email: currentUser.email,
            name: currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'User',
            subscription_status: 'free'
        };
    }
}

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

// Missing notification functions
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

function showEditTimeModal(timeBlock, originalTime) {
    if (!currentUser) {
        showNotification('Please log in to edit your routine', 'warning');
        return;
    }

    currentEditingBlock = timeBlock;
    const modal = document.getElementById('editTimeModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Pre-fill form with current values
        const timeRange = originalTime.split(' - ');
        if (timeRange.length === 2) {
            document.getElementById('editStartTime').value = convertTo24Hour(timeRange[0]);
            document.getElementById('editEndTime').value = convertTo24Hour(timeRange[1]);
        }

        const currentActivity = timeBlock.querySelector('p').textContent;
        const currentDescription = timeBlock.querySelector('small').textContent;

        document.getElementById('editActivityName').value = currentActivity.replace(/[^\w\s]/gi, '');
        document.getElementById('editActivityDescription').value = currentDescription;
    }
}

function showProgressCustomization() {
    if (!currentUser) {
        showNotification('Please log in to customize your progress tracking', 'warning');
        return;
    }

    const modal = document.getElementById('progressCustomModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
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

async function initializeUserSystems() {
    if (!currentUser || !supabaseClient) return;

    try {
        // Load user notifications and data
        await loadUserNotifications();
        await addWelcomeNotification();

        // Initialize progress tracking
        await initializeProgressTracking();

        // Start tracking session
        await startProgressSession();

        console.log('User systems initialized successfully');

    } catch (error) {
        console.error('Error initializing user systems:', error);
    }
}

async function initializeProgressTracking() {
    if (!currentUser) return;

    try {
        // Initialize today's progress tracking
        const today = new Date().toISOString().split('T')[0];

        const { data: existing, error: checkError } = await supabaseClient
            .from('daily_progress')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('date', today)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
        }

        if (!existing) {
            // Create today's progress entry
            const { error: insertError } = await supabaseClient
                .from('daily_progress')
                .insert([{
                    user_id: currentUser.id,
                    date: today,
                    routine_created: false,
                    audio_listened: false,
                    video_watched: false,
                    exercise_completed: false,
                    meditation_done: false,
                    reading_done: false,
                    updated_at: new Date().toISOString()
                }]);

            if (insertError) throw insertError;
        }

        console.log('Progress tracking initialized for today');
    } catch (error) {
        console.error('Error initializing progress tracking:', error);
    }
}

async function startProgressSession() {
    if (!currentUser) return;

    try {
        // Log session start
        const { error } = await supabaseClient
            .from('user_notifications')
            .insert([{
                user_id: currentUser.id,
                message: `📊 Progress tracking active! Your actions today will be recorded to help you build unstoppable momentum.`,
                type: 'info',
                is_read: false,
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;

        // Refresh notifications
        await loadUserNotifications();

    } catch (error) {
        console.error('Error starting progress session:', error);
    }
}

async function showProgressSummary() {
    if (!currentUser) return;

    try {
        // Get recent progress
        const { data: recentProgress, error } = await supabaseClient
            .from('daily_progress')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('date', { ascending: false })
            .limit(7);

        if (error) throw error;

        const completedDays = recentProgress ? recentProgress.filter(day => 
            Object.values(day).some(value => typeof value === 'boolean' && value === true)
        ).length : 0;

        showStyledNotification(
            '📈 Your Progress Summary', 
            `You've been active ${completedDays} out of the last 7 days. Keep building that momentum!`, 
            'info'
        );

    } catch (error) {
        console.error('Error showing progress summary:', error);
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