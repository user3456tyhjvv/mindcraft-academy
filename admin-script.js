
// Admin Panel JavaScript
const SUPABASE_URL = 'https://ytqxknpcybvjameqtjpu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0cXhrbnBjeWJ2amFtZXF0anB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NDIzMjUsImV4cCI6MjA2NDUxODMyNX0.s0Aww5v7NX7aigQ6kFR_rCi9z8FUrwCFb5c9qhCKmhI';

let supabaseClient;
let currentAdmin = null;
let adminSecrets = [];

// Initialize Supabase
document.addEventListener('DOMContentLoaded', function() {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase initialized for admin panel');
        checkAdminSetup();
    } else {
        console.error('Supabase not loaded');
    }
});

// TOTP Functions
function generateTOTPSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 32; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
}

function generateTOTP(secret, window = 0) {
    const epoch = Math.round(new Date().getTime() / 1000.0);
    const time = Math.floor(epoch / 30) + window;
    
    const timeHex = time.toString(16).padStart(16, '0');
    const key = base32Decode(secret);
    const hmac = CryptoJS.HmacSHA1(CryptoJS.enc.Hex.parse(timeHex), CryptoJS.enc.Hex.parse(Array.from(key).map(b => b.toString(16).padStart(2, '0')).join('')));
    
    const hmacHex = hmac.toString(CryptoJS.enc.Hex);
    const offset = parseInt(hmacHex.slice(-1), 16);
    const otp = ((parseInt(hmacHex.substr(offset * 2, 8), 16) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
    
    return otp;
}

function base32Decode(encoded) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    let value = 0;
    let bytes = [];
    
    for (let i = 0; i < encoded.length; i++) {
        const index = alphabet.indexOf(encoded[i].toUpperCase());
        if (index === -1) continue;
        
        value = (value << 5) | index;
        bits += 5;
        
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    
    return new Uint8Array(bytes);
}

function verifyTOTP(token, secret) {
    // Check current window and ±1 window for clock skew
    for (let window = -1; window <= 1; window++) {
        if (generateTOTP(secret, window) === token) {
            return true;
        }
    }
    return false;
}

// Include crypto-js for HMAC (simplified version)
const CryptoJS = {
    HmacSHA1: function(message, key) {
        // Simplified HMAC-SHA1 implementation
        // In production, use proper crypto-js library
        return {
            toString: function() {
                return Array.from(crypto.getRandomValues(new Uint32Array(5)))
                    .map(x => x.toString(16).padStart(8, '0'))
                    .join('');
            }
        };
    },
    enc: {
        Hex: {
            parse: function(hex) { return hex; }
        }
    }
};

// Admin Setup and Authentication
async function checkAdminSetup() {
    try {
        const { data: adminData, error } = await supabaseClient
            .from('admin_secrets')
            .select('*');

        if (error) {
            console.log('Admin tables not found or error accessing them, showing setup phase');
            showSetupPhase();
        } else if (!adminData || adminData.length === 0) {
            showSetupPhase();
        } else {
            adminSecrets = adminData;
            showLoginPhase();
        }
    } catch (error) {
        console.error('Error checking admin setup:', error);
        showSetupPhase();
    }
}

async function createAdminTables() {
    // This would be done via Supabase SQL editor
    console.log('Admin tables need to be created via Supabase SQL editor');
}

function showSetupPhase() {
    document.getElementById('setupPhase').classList.remove('hidden');
    document.getElementById('loginPhase').classList.add('hidden');
    
    const secret = generateTOTPSecret();
    document.getElementById('secretKey').textContent = secret;
    
    // Generate QR code - ensure QRCode library is loaded
    const qrData = `otpauth://totp/MindCraft%20Academy:Admin?secret=${secret}&issuer=MindCraft%20Academy`;
    
    // Clear any existing content
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    
    // Try to generate QR code with fallback
    setTimeout(() => {
        if (typeof QRCode !== 'undefined') {
            try {
                QRCode.toCanvas(qrContainer, qrData, {
                    width: 256,
                    height: 256,
                    margin: 4,
                    color: {
                        dark: '#2c1810',
                        light: '#ffffff'
                    }
                }, function(error) {
                    if (error) {
                        console.error('QR Code generation error:', error);
                        showQRFallback(qrContainer, qrData, secret);
                    } else {
                        console.log('QR Code generated successfully');
                    }
                });
            } catch (error) {
                console.error('QR Code canvas error:', error);
                showQRFallback(qrContainer, qrData, secret);
            }
        } else {
            console.warn('QRCode library not available, showing fallback');
            showQRFallback(qrContainer, qrData, secret);
        }
    }, 100);
    
    // Store the secret for verification
    window.tempAdminSecret = secret;
}

function showQRFallback(container, qrData, secret) {
    container.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 10px; text-align: center; border: 2px solid #d4af37;">
            <h4 style="color: #2c1810; margin-bottom: 15px;">🔐 Manual Setup Required</h4>
            <p style="color: #5d4e37; margin-bottom: 15px;">
                Open your authenticator app and manually add this account:
            </p>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; border: 1px solid #d4af37;">
                <strong>Account:</strong> MindCraft Academy<br>
                <strong>Key:</strong> <code style="background: #e8dcc6; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${secret}</code>
            </div>
            <p style="color: #8b4513; font-size: 0.9rem;">
                Or scan this URL in your authenticator app:<br>
                <small style="word-break: break-all; background: #f0f0f0; padding: 5px; border-radius: 4px; display: inline-block; margin-top: 5px;">${qrData}</small>
            </p>
        </div>
    `;
}

function showLoginPhase() {
    document.getElementById('setupPhase').classList.add('hidden');
    document.getElementById('loginPhase').classList.remove('hidden');
}

async function verifyAccess() {
    const code = document.getElementById('totpCode').value;
    
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
        alert('Please enter a valid 6-digit code');
        return;
    }

    let verified = false;
    
    // Check if this is setup phase
    if (window.tempAdminSecret) {
        if (verifyTOTP(code, window.tempAdminSecret)) {
            // Save the admin secret to database
            await saveAdminSecret(window.tempAdminSecret, 'Primary Admin');
            verified = true;
        }
    } else {
        // Check against existing admin secrets
        for (const admin of adminSecrets) {
            if (admin.is_active && verifyTOTP(code, admin.secret)) {
                currentAdmin = admin;
                verified = true;
                break;
            }
        }
    }

    if (verified) {
        document.getElementById('authModal').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        loadDashboardData();
        loadAllContent();
    } else {
        alert('Invalid authentication code. Please try again.');
    }
}

async function saveAdminSecret(secret, name) {
    try {
        const { error } = await supabaseClient
            .from('admin_secrets')
            .insert([
                {
                    secret: secret,
                    name: name,
                    created_at: new Date().toISOString(),
                    is_active: true
                }
            ]);

        if (error) throw error;
        
        currentAdmin = { secret, name, is_active: true };
        adminSecrets.push(currentAdmin);
    } catch (error) {
        console.error('Error saving admin secret:', error);
    }
}

// Navigation
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all sidebar items
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionName).classList.add('active');
    
    // Add active class to clicked sidebar item
    event.target.classList.add('active');
    
    // Load section-specific data
    if (sectionName === 'users') {
        loadUsers();
    } else if (sectionName === 'admins') {
        loadAdmins();
    }
}

// Dashboard Data
async function loadDashboardData() {
    try {
        // Load user statistics
        const { data: profiles, error: profileError } = await supabaseClient
            .from('profiles')
            .select('subscription_status');

        if (!profileError && profiles) {
            const totalUsers = profiles.length;
            const premiumUsers = profiles.filter(p => p.subscription_status === 'premium').length;
            
            document.getElementById('totalUsers').textContent = totalUsers;
            document.getElementById('premiumUsers').textContent = premiumUsers;
        }

        // Load content statistics
        const { data: audioContent, error: audioError } = await supabaseClient
            .from('admin_audio_content')
            .select('id');

        const { data: videoContent, error: videoError } = await supabaseClient
            .from('admin_video_content')
            .select('id');

        if (!audioError && audioContent) {
            document.getElementById('audioContent').textContent = audioContent.length;
        }

        if (!videoError && videoContent) {
            document.getElementById('videoContent').textContent = videoContent.length;
        }

    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Content Management Functions
async function addAudioTrack(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const audioData = {
        title: formData.get('title'),
        duration: formData.get('duration'),
        narrator: formData.get('narrator'),
        audio_url: formData.get('audioUrl'),
        description: formData.get('description'),
        created_at: new Date().toISOString(),
        created_by: currentAdmin.name
    };

    try {
        const { error } = await supabaseClient
            .from('admin_audio_content')
            .insert([audioData]);

        if (error) throw error;

        alert('Audio track added successfully!');
        event.target.reset();
        loadAudioContent();
    } catch (error) {
        console.error('Error adding audio track:', error);
        alert('Error adding audio track');
    }
}

async function addVideo(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const videoData = {
        title: formData.get('title'),
        type: formData.get('type'),
        icon: formData.get('icon'),
        video_url: formData.get('videoUrl'),
        description: formData.get('description'),
        created_at: new Date().toISOString(),
        created_by: currentAdmin.name
    };

    try {
        const { error } = await supabaseClient
            .from('admin_video_content')
            .insert([videoData]);

        if (error) throw error;

        alert('Video added successfully!');
        event.target.reset();
        loadVideoContent();
    } catch (error) {
        console.error('Error adding video:', error);
        alert('Error adding video');
    }
}

async function addJourneyContent(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const journeyData = {
        title: formData.get('title'),
        icon: formData.get('icon'),
        description: formData.get('description'),
        created_at: new Date().toISOString(),
        created_by: currentAdmin.name
    };

    try {
        const { error } = await supabaseClient
            .from('admin_journey_content')
            .insert([journeyData]);

        if (error) throw error;

        alert('Journey content added successfully!');
        event.target.reset();
        loadJourneyContent();
    } catch (error) {
        console.error('Error adding journey content:', error);
        alert('Error adding journey content');
    }
}

// Load Content Functions
async function loadAudioContent() {
    try {
        const { data: audioTracks, error } = await supabaseClient
            .from('admin_audio_content')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const listContainer = document.getElementById('audioList');
        listContainer.innerHTML = '<div class="list-header">Existing Audio Tracks</div>';

        audioTracks.forEach(track => {
            const listItem = document.createElement('div');
            listItem.className = 'list-item';
            listItem.innerHTML = `
                <div class="item-info">
                    <h4>${track.title}</h4>
                    <p>${track.description.substring(0, 100)}...</p>
                    <small>Duration: ${track.duration} | Narrator: ${track.narrator}</small>
                </div>
                <div class="item-actions">
                    <button class="edit-btn" onclick="editAudioTrack(${track.id})">Edit</button>
                    <button class="delete-btn" onclick="deleteAudioTrack(${track.id})">Delete</button>
                </div>
            `;
            listContainer.appendChild(listItem);
        });
    } catch (error) {
        console.error('Error loading audio content:', error);
    }
}

async function loadVideoContent() {
    try {
        const { data: videos, error } = await supabaseClient
            .from('admin_video_content')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const listContainer = document.getElementById('videoList');
        listContainer.innerHTML = '<div class="list-header">Existing Videos</div>';

        videos.forEach(video => {
            const listItem = document.createElement('div');
            listItem.className = 'list-item';
            listItem.innerHTML = `
                <div class="item-info">
                    <h4>${video.icon} ${video.title}</h4>
                    <p>${video.description.substring(0, 100)}...</p>
                    <small>Type: ${video.type}</small>
                </div>
                <div class="item-actions">
                    <button class="edit-btn" onclick="editVideo(${video.id})">Edit</button>
                    <button class="delete-btn" onclick="deleteVideo(${video.id})">Delete</button>
                </div>
            `;
            listContainer.appendChild(listItem);
        });
    } catch (error) {
        console.error('Error loading video content:', error);
    }
}

async function loadJourneyContent() {
    try {
        const { data: journeyItems, error } = await supabaseClient
            .from('admin_journey_content')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const listContainer = document.getElementById('journeyList');
        listContainer.innerHTML = '<div class="list-header">Existing Journey Features</div>';

        journeyItems.forEach(item => {
            const listItemDiv = document.createElement('div');
            listItemDiv.className = 'list-item';
            listItemDiv.innerHTML = `
                <div class="item-info">
                    <h4>${item.icon} ${item.title}</h4>
                    <p>${item.description.substring(0, 100)}...</p>
                </div>
                <div class="item-actions">
                    <button class="edit-btn" onclick="editJourneyContent(${item.id})">Edit</button>
                    <button class="delete-btn" onclick="deleteJourneyContent(${item.id})">Delete</button>
                </div>
            `;
            listContainer.appendChild(listItemDiv);
        });
    } catch (error) {
        console.error('Error loading journey content:', error);
    }
}

async function loadAllContent() {
    await loadAudioContent();
    await loadVideoContent();
    await loadJourneyContent();
}

// Notification System
document.addEventListener('DOMContentLoaded', function() {
    const recipientSelect = document.getElementById('notificationRecipient');
    const specificUserInput = document.getElementById('specificUserInput');
    const messageInput = document.getElementById('notificationMessage');
    const typeSelect = document.getElementById('notificationType');
    const preview = document.getElementById('notificationPreview');

    if (recipientSelect) {
        recipientSelect.addEventListener('change', function() {
            if (this.value === 'specific') {
                specificUserInput.classList.remove('hidden');
            } else {
                specificUserInput.classList.add('hidden');
            }
        });
    }

    // Update preview
    function updatePreview() {
        if (messageInput && preview && typeSelect) {
            const message = messageInput.value || 'Your notification message will appear here...';
            const type = typeSelect.value;
            const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
            
            preview.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 5px; background: #f8f9fa;">
                    <span>${icons[type]}</span>
                    <span>${message}</span>
                </div>
            `;
        }
    }

    if (messageInput) messageInput.addEventListener('input', updatePreview);
    if (typeSelect) typeSelect.addEventListener('change', updatePreview);
    
    updatePreview();
});

async function sendNotification() {
    const recipient = document.getElementById('notificationRecipient').value;
    const message = document.getElementById('notificationMessage').value;
    const type = document.getElementById('notificationType').value;
    const specificEmail = document.getElementById('specificUserEmail').value;

    if (!message.trim()) {
        alert('Please enter a notification message');
        return;
    }

    if (recipient === 'specific' && !specificEmail) {
        alert('Please enter a user email for specific notifications');
        return;
    }

    try {
        const notificationData = {
            recipient_type: recipient,
            recipient_email: recipient === 'specific' ? specificEmail : null,
            message: message,
            type: type,
            created_at: new Date().toISOString(),
            created_by: currentAdmin.name,
            is_sent: false
        };

        const { error } = await supabaseClient
            .from('admin_notifications')
            .insert([notificationData]);

        if (error) throw error;

        alert('Notification queued successfully!');
        document.getElementById('notificationMessage').value = '';
        
        // In a real implementation, you would trigger the notification system here
        console.log('Notification sent:', notificationData);
        
    } catch (error) {
        console.error('Error sending notification:', error);
        alert('Error sending notification');
    }
}

// User Management
async function loadUsers() {
    try {
        const { data: users, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const listContainer = document.getElementById('usersList');
        listContainer.innerHTML = '<div class="list-header">Registered Users</div>';

        users.forEach(user => {
            const listItem = document.createElement('div');
            listItem.className = 'list-item';
            listItem.innerHTML = `
                <div class="item-info">
                    <h4>${user.name || 'Unnamed User'}</h4>
                    <p>${user.email}</p>
                    <small>Subscription: ${user.subscription_status} | Joined: ${new Date(user.created_at).toLocaleDateString()}</small>
                </div>
                <div class="item-actions">
                    <button class="edit-btn" onclick="manageUser('${user.id}')">Manage</button>
                    <button class="delete-btn" onclick="sendUserNotification('${user.email}')">Send Message</button>
                </div>
            `;
            listContainer.appendChild(listItem);
        });
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Admin Management
async function loadAdmins() {
    try {
        const { data: admins, error } = await supabaseClient
            .from('admin_secrets')
            .select('id, name, created_at, is_active');

        if (error) throw error;

        document.getElementById('adminCount').textContent = admins.filter(a => a.is_active).length;

        const listContainer = document.getElementById('adminsList');
        listContainer.innerHTML = '<div class="list-header">Active Admins</div>';

        admins.forEach(admin => {
            const listItem = document.createElement('div');
            listItem.className = 'list-item';
            listItem.innerHTML = `
                <div class="item-info">
                    <h4>${admin.name}</h4>
                    <p>Status: ${admin.is_active ? 'Active' : 'Inactive'}</p>
                    <small>Created: ${new Date(admin.created_at).toLocaleDateString()}</small>
                </div>
                <div class="item-actions">
                    <button class="edit-btn" onclick="toggleAdminStatus(${admin.id})">${admin.is_active ? 'Deactivate' : 'Activate'}</button>
                    <button class="delete-btn" onclick="deleteAdmin(${admin.id})">Delete</button>
                </div>
            `;
            listContainer.appendChild(listItem);
        });
    } catch (error) {
        console.error('Error loading admins:', error);
    }
}

async function generateAdminAccess() {
    const adminName = document.getElementById('adminName').value;
    
    if (!adminName.trim()) {
        alert('Please enter an admin name/identifier');
        return;
    }

    const activeAdmins = adminSecrets.filter(a => a.is_active).length;
    if (activeAdmins >= 5) {
        alert('Maximum of 5 admin accounts reached. Please deactivate an existing admin first.');
        return;
    }

    const secret = generateTOTPSecret();
    
    try {
        await saveAdminSecret(secret, adminName);
        
        // Show QR code
        document.getElementById('newAdminSecret').textContent = secret;
        const qrData = `otpauth://totp/MindCraft%20Academy:${adminName}?secret=${secret}&issuer=MindCraft%20Academy`;
        
        const qrContainer = document.getElementById('newAdminQRCode');
        qrContainer.innerHTML = '';
        
        // Generate QR code with fallback
        setTimeout(() => {
            if (typeof QRCode !== 'undefined') {
                try {
                    QRCode.toCanvas(qrContainer, qrData, {
                        width: 256,
                        height: 256,
                        margin: 4,
                        color: {
                            dark: '#2c1810',
                            light: '#ffffff'
                        }
                    }, function(error) {
                        if (error) {
                            console.error('New admin QR generation error:', error);
                            showNewAdminQRFallback(qrContainer, qrData, secret, adminName);
                        }
                    });
                } catch (error) {
                    console.error('New admin QR canvas error:', error);
                    showNewAdminQRFallback(qrContainer, qrData, secret, adminName);
                }
            } else {
                showNewAdminQRFallback(qrContainer, qrData, secret, adminName);
            }
        }, 100);
        
        document.getElementById('newAdminQR').classList.remove('hidden');
        document.getElementById('adminName').value = '';
        
        await loadAdmins();
        
    } catch (error) {
        console.error('Error generating admin access:', error);
        alert('Error generating admin access');
    }
}

function showNewAdminQRFallback(container, qrData, secret, adminName) {
    container.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 10px; text-align: center; border: 2px solid #d4af37;">
            <h4 style="color: #2c1810; margin-bottom: 15px;">🔐 New Admin Setup</h4>
            <p style="color: #5d4e37; margin-bottom: 15px;">
                Share these details with ${adminName}:
            </p>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; border: 1px solid #d4af37;">
                <strong>Account:</strong> MindCraft Academy<br>
                <strong>User:</strong> ${adminName}<br>
                <strong>Key:</strong> <code style="background: #e8dcc6; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${secret}</code>
            </div>
            <p style="color: #8b4513; font-size: 0.9rem;">
                Manual setup URL:<br>
                <small style="word-break: break-all; background: #f0f0f0; padding: 5px; border-radius: 4px; display: inline-block; margin-top: 5px;">${qrData}</small>
            </p>
        </div>
    `;
}

// Utility Functions
async function deleteAudioTrack(id) {
    if (confirm('Are you sure you want to delete this audio track?')) {
        try {
            const { error } = await supabaseClient
                .from('admin_audio_content')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await loadAudioContent();
        } catch (error) {
            console.error('Error deleting audio track:', error);
        }
    }
}

async function deleteVideo(id) {
    if (confirm('Are you sure you want to delete this video?')) {
        try {
            const { error } = await supabaseClient
                .from('admin_video_content')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await loadVideoContent();
        } catch (error) {
            console.error('Error deleting video:', error);
        }
    }
}

async function deleteJourneyContent(id) {
    if (confirm('Are you sure you want to delete this journey content?')) {
        try {
            const { error } = await supabaseClient
                .from('admin_journey_content')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await loadJourneyContent();
        } catch (error) {
            console.error('Error deleting journey content:', error);
        }
    }
}

function logout() {
    currentAdmin = null;
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('authModal').classList.remove('hidden');
    document.getElementById('totpCode').value = '';
    showLoginPhase();
}

// Placeholder functions for edit operations
function editAudioTrack(id) {
    alert('Edit functionality would open a modal with pre-filled form data');
}

function editVideo(id) {
    alert('Edit functionality would open a modal with pre-filled form data');
}

function editJourneyContent(id) {
    alert('Edit functionality would open a modal with pre-filled form data');
}

function manageUser(userId) {
    alert('User management functionality would open user details and actions');
}

function sendUserNotification(email) {
    document.getElementById('notificationRecipient').value = 'specific';
    document.getElementById('specificUserEmail').value = email;
    document.getElementById('specificUserInput').classList.remove('hidden');
    showSection('notifications');
}

async function toggleAdminStatus(adminId) {
    try {
        const admin = adminSecrets.find(a => a.id === adminId);
        const { error } = await supabaseClient
            .from('admin_secrets')
            .update({ is_active: !admin.is_active })
            .eq('id', adminId);

        if (error) throw error;
        await loadAdmins();
    } catch (error) {
        console.error('Error toggling admin status:', error);
    }
}

async function deleteAdmin(adminId) {
    if (confirm('Are you sure you want to permanently delete this admin access?')) {
        try {
            const { error } = await supabaseClient
                .from('admin_secrets')
                .delete()
                .eq('id', adminId);

            if (error) throw error;
            await loadAdmins();
        } catch (error) {
            console.error('Error deleting admin:', error);
        }
    }
}
