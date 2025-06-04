
// Editing Functionality
let editingMode = false;
let currentEditingBlock = null;

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

        // Save custom habits to user profile
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
