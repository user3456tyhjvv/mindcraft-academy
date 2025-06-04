// Editing Functionality
var editingMode = false;
var currentEditingBlock = null;

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

// Time Editing Functions
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
        if (typeof addUserNotification === 'function') {
            await addUserNotification(`✅ Routine updated: ${activityName} scheduled for ${convertTo12Hour(startTime)} - ${convertTo12Hour(endTime)}`, 'success');
        }

    } catch (error) {
        console.error('Error saving routine:', error);
        showNotification('Error saving time block', 'error');
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

// Progress Customization Functions
function showProgressCustomization() {
    const modal = document.getElementById('progressCustomModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        // Create modal if it doesn't exist
        createProgressCustomModal();
    }
}

function closeProgressCustomModal() {
    const modal = document.getElementById('progressCustomModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function createProgressCustomModal() {
    const modal = document.createElement('div');
    modal.id = 'progressCustomModal';
    modal.className = 'auth-modal';
    modal.innerHTML = `
        <div class="auth-form" style="max-width: 600px;">
            <button class="close-modal" onclick="closeProgressCustomModal()">&times;</button>
            <h2 class="form-title">🎯 Customize Your Progress Tracking</h2>
            <p style="color: #5d4e37; margin-bottom: 25px; text-align: center;">Add your personal goals and habits to track</p>

            <div style="background: #f9f6f0; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
                <h4 style="color: #2c1810; margin-bottom: 15px;">💡 Recommended Categories:</h4>

                <div class="form-group">
                    <label>🧘 Mindfulness & Mental Health</label>
                    <input type="text" class="form-input custom-habit-input" data-category="mindfulness"
                        placeholder="e.g., 10 minutes meditation, journaling">
                </div>

                <div class="form-group">
                    <label>💪 Physical Health</label>
                    <input type="text" class="form-input custom-habit-input" data-category="health"
                        placeholder="e.g., 8 glasses of water, 30-min exercise">
                </div>

                <div class="form-group">
                    <label>🎯 Productivity & Skills</label>
                    <input type="text" class="form-input custom-habit-input" data-category="productivity"
                        placeholder="e.g., Learn new skill, complete priorities">
                </div>

                <div class="form-group">
                    <label>👥 Relationships & Social</label>
                    <input type="text" class="form-input custom-habit-input" data-category="social"
                        placeholder="e.g., Call family, help someone">
                </div>

                <div class="form-group">
                    <label>🌱 Personal Growth</label>
                    <input type="text" class="form-input custom-habit-input" data-category="growth"
                        placeholder="e.g., Practice gratitude, learn something new">
                </div>
            </div>

            <button class="form-button" onclick="saveProgressCustomization()">
                🚀 Save My Custom Tracking
            </button>
        </div>
    `;

    document.body.appendChild(modal);
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function saveProgressCustomization() {
    const inputs = document.querySelectorAll('.custom-habit-input');
    const customHabits = [];

    inputs.forEach(input => {
        if (input.value.trim()) {
            customHabits.push({
                category: input.dataset.category,
                habit: input.value.trim()
            });
        }
    });

    if (customHabits.length === 0) {
        showNotification('Please add at least one custom habit', 'warning');
        return;
    }

    try {
        // In a real app, save to database
        console.log('Saving custom habits:', customHabits);

        closeProgressCustomModal();
        showNotification(`🎯 Added ${customHabits.length} custom habits to track!`, 'success');

        if (typeof addUserNotification === 'function') {
            await addUserNotification(`📊 Progress tracking customized with ${customHabits.length} new habits`, 'success');
        }

    } catch (error) {
        console.error('Error saving custom habits:', error);
        showNotification('Error saving custom habits', 'error');
    }
}

// Time Conversion Utilities
function convertTo12Hour(time24) {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${period}`;
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

async function trackRoutineChange(action, time) {
    if (!currentUser || !supabaseClient) return;

    try {
        await addUserNotification(`📅 Routine ${action}: ${time}`, 'info');
        await updateDailyProgress('routine_created', true);
    } catch (error) {
        console.error('Error tracking routine change:', error);
    }
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

        // Show better notification when routine is locked in
        await addUserNotification(`🎯 Routine Locked In! You've committed to ${selectedBlocks.length} productive time blocks today. Every action you take builds unstoppable momentum toward your goals!`, 'success');

    } catch (error) {
        console.error('Error saving routine:', error);
        showNotification('Error saving routine', 'error');
    }
}

// Global variables initialized at top of file