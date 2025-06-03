
// Supabase configuration - Replace with your actual credentials
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

// Initialize Supabase client
let supabaseClient;

// User session management
let currentUser = null;
let userSubscription = null;
let userProgress = null;
let userRoutine = [];
let editingMode = false;
let currentEditingBlock = null;

// Audio tracking
let currentlyPlaying = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase initialized successfully');
        checkUserSession();
        setupAudioPlayers();
    } else {
        console.error('Supabase not loaded');
        showNotification('Supabase connection failed', 'error');
    }
});

// Supabase Database Setup Functions
async function initializeUserTables() {
    if (!supabaseClient) return;

    try {
        // Create user profile if doesn't exist
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (profileError && profileError.code === 'PGRST116') {
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
        const { data: progress, error } = await supabaseClient
            .from('user_progress')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();

        if (error && error.code === 'PGRST116') {
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
        } else if (!error) {
            userProgress = progress;
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
            showNotification(`Welcome back, ${currentUser.email}!`, 'success');
            
            // Check subscription status
            await checkSubscriptionStatus();
        }
    } catch (error) {
        console.error('Error checking session:', error);
    }
}

async function checkSubscriptionStatus() {
    try {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('subscription_status, subscription_end_date')
            .eq('id', currentUser.id)
            .single();

        if (!error && profile) {
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
    
    if (currentlyPlaying && currentlyPlaying !== audio) {
        currentlyPlaying.pause();
        resetAudioUI(currentlyPlaying);
    }

    if (audio.paused) {
        audio.play();
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

    // In a real app, this would download the actual audio file
    const link = document.createElement('a');
    link.href = `https://example.com/audio/${trackName}.mp3`;
    link.download = `${trackName}.mp3`;
    link.click();
    
    showNotification(`Downloading: ${trackName}`, 'success');
    trackAudioProgress(trackName, 'downloaded');
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
                await initializeUserTables();
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
                await initializeUserTables();
                updateUserInterface();
                closeAuthModal();
                const displayName = data.user.user_metadata?.name || email.split('@')[0];
                showNotification(`Welcome back, ${displayName}!`, 'success');
                
                await checkSubscriptionStatus();
            }
        }
    } catch (error) {
        console.error('Auth error:', error);
        showNotification('Authentication failed. Please try again.', 'error');
    } finally {
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
        userSubscription = null;
        userProgress = null;
        userRoutine = [];
        updateUserInterface();
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
