const socket = io();

// Initial tasks array (default if DB empty)
let tasks = [
    { name: "Exercise", subtasks: ["Swimming", "Running", "App Guided Exercise", "Gym", "Swimming + Running", "Running + Gym", "Swimming + Gym"], prob: 1, color: "#ff6b6b" },
    { name: "Drum Practice", subtasks: ["Free Practice", { name: "Specific Skills Practice", subtasks: ["Hands", "Feet", "Beats", "Learning Songs"] }], prob: 1, color: "#4ecdc4" },
    { name: "Cleaning / Minimising Stuff", subtasks: [], prob: 1, color: "#45b7d1" },
    { name: "Absolute Zero", subtasks: ["Project Work", "Recording", "Writing"], prob: 1, color: "#96c93d" },
    { name: "Squelch", subtasks: ["Writing", "Live Prep", "Finishing And Publishing"], prob: 1, color: "#50c93d" },
    { name: "Work On Something Old", subtasks: ["Goldilocks Zone", "Meta Stuff", "Vartey", "Charlie Stuff", "Noodle Soup Stuff", "Men Of Faith"], prob: 1, color: "#14c93d" },
    { name: "AI - Apps - Web", subtasks: ["AI Video Stuff", "AI Website", "German Doctor Story", "Drum App"], prob: 1, color: "#2a9d8f" },
    { name: "Continued Javascript Learning", subtasks: [], prob: 1, color: "#d45087" },
    { name: "Read", subtasks: [], prob: 1, color: "#e76f51" },
    { name: "Connect With Someone", subtasks: ["Mum", "Dad", "Alex", "Maddy", "Nanna", "James", "Andy", "Duncan", "Sam", "Amy Lamb", "Skinny", "Nina", "Marcos", "Dylan"], prob: 1, color: "#9b59b6" }
];

// State
let currentTask = null;
let timer = 0;
let isPaused = false;
let interval = null;
let completedTasks = [];
let lastClickedTask = null;
const today = new Date();

// Format time in seconds to HH:MM:SS
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600).toString().padStart(2, "0");
    const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}:${secs}`;
}

// API Functions
async function fetchTasks() {
    try {
        const response = await fetch('/api/tasks');
        if (!response.ok) {
            console.error('Fetch tasks response not OK:', response.status, response.statusText);
            throw new Error('Failed to fetch tasks');
        }
        const data = await response.json();
        console.log('Fetched tasks:', data);
        return data;
    } catch (err) {
        console.error('Error fetching tasks:', err);
        return [];
    }
}

async function fetchCompletedTasks() {
    try {
        const response = await fetch('/api/completed-tasks');
        if (!response.ok) {
            console.error('Fetch completed tasks response not OK:', response.status, response.statusText);
            throw new Error('Failed to fetch completed tasks');
        }
        const data = await response.json();
        console.log('Fetched completed tasks with IDs:', data); // Debug log
        return data;
    } catch (err) {
        console.error('Error fetching completed tasks:', err);
        return [];
    }
}

async function saveTasks(tasksToSave) {
    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tasksToSave),
        });
        if (!response.ok) throw new Error('Failed to save tasks');
        console.log('Tasks saved successfully');
        return true;
    } catch (err) {
        console.error('Error saving tasks:', err);
        return false;
    }
}

async function saveCompletedTask(task) {
    try {
        const response = await fetch('/api/completed-tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task),
        });
        if (!response.ok) throw new Error('Failed to save completed task');
        const data = await response.json();
        console.log('Saved completed task response:', data); // Debug log
        console.log('Completed task saved:', task);
        return true;
    } catch (err) {
        console.error('Error saving completed task:', err);
        return false;
    }
}

// Random task generator
function generateTask() {
    console.log("Generate Task clicked", { tasks: tasks.length });
    if (tasks.length === 0) {
        document.getElementById("task-text").innerHTML = "No Tasks Available";
        console.warn("No tasks available");
        return;
    }

    const validTasks = tasks.filter(task => task && typeof task === "object" && "name" in task);
    if (validTasks.length === 0) {
        document.getElementById("task-text").innerHTML = "No Valid Tasks Available";
        console.error("No valid tasks with 'name' property");
        return;
    }

    const totalWeight = validTasks.reduce((sum, task) => sum + Math.max(task.prob || 1, 0.1), 0);
    let rand = Math.random() * totalWeight;
    let selectedTask = validTasks[0];

    for (const task of validTasks) {
        const weight = Math.max(task.prob || 1, 0.1);
        if (rand <= weight) {
            selectedTask = task;
            break;
        }
        rand -= weight;
    }

    console.log("Selected Task:", selectedTask);

    let subtask = selectedTask.subtasks.length ? selectedTask.subtasks[Math.floor(Math.random() * selectedTask.subtasks.length)] : "";
    const subtaskName = typeof subtask === "object" && subtask ? subtask.name : (typeof subtask === "string" ? subtask : "");
    console.log("Subtask:", subtask, "Subtask Name:", subtaskName);

    const time = 30 * (1 + Math.floor(Math.random() * 6));
    currentTask = { task: selectedTask.name, subtask: subtaskName, time, start: null, end: null, comment: "", color: selectedTask.color };
    document.getElementById("task-text").innerHTML = `${selectedTask.name}${subtaskName ? " - " + subtaskName : ""} (${time / 60} hours)`;
    document.getElementById("suggestion").style.setProperty('--task-color', selectedTask.color);
    document.getElementById("start-btn").disabled = false;
    document.getElementById("time-up").disabled = false;
    document.getElementById("time-down").disabled = false;
    socket.emit('taskGenerated', currentTask); // Broadcast new task to all devices
}

// Manual task selection
function selectTask(taskName, subtask = null) {
    const task = tasks.find(t => t.name === taskName);
    if (!task) return;
    const time = 30 * (1 + Math.floor(Math.random() * 6));
    const subtaskName = typeof subtask === "object" && subtask ? subtask.name : (typeof subtask === "string" ? subtask : "");
    currentTask = { task: taskName, subtask: subtaskName, time, start: null, end: null, comment: "", color: task.color };
    document.getElementById("task-text").innerHTML = `${taskName}${subtaskName ? " - " + subtaskName : ""} (${time / 60} hours)`;
    document.getElementById("suggestion").style.setProperty('--task-color', task.color);
    document.getElementById("start-btn").disabled = false;
    document.getElementById("time-up").disabled = false;
    document.getElementById("time-down").disabled = false;
    socket.emit('taskSelected', currentTask); // Broadcast task selection to all devices
}

// Time adjustment
function adjustTime(direction) {
    if (!currentTask) return;
    const increment = direction === "up" ? 30 : -30;
    currentTask.time = Math.max(30, currentTask.time + increment);
    document.getElementById("task-text").innerHTML = `${currentTask.task}${currentTask.subtask ? " - " + currentTask.subtask : ""} (${currentTask.time / 60} hours)`;
    socket.emit('taskAdjusted', currentTask); // Broadcast time adjustment to all devices
}

// State
let startTimestamp = null;
let pauseTimestamp = null;
let totalPausedTime = 0;

// Timer functionality
function startTimer() {
    if (!currentTask) return;
    currentTask.start = new Date();
    startTimestamp = Date.now();
    totalPausedTime = 0;
    interval = setInterval(() => {
        if (!isPaused) {
            timer = calculateElapsedTime();
            document.getElementById("timer").textContent = formatTime(timer);
            socket.emit('timerUpdate', { timer, isPaused, currentTask, startTimestamp, totalPausedTime });
        }
    }, 1000);
    document.getElementById("pause-btn").disabled = false;
    document.getElementById("finish-btn").disabled = false;
    document.getElementById("start-btn").disabled = true;
    socket.emit('timerStarted', { timer, isPaused, currentTask, startTimestamp, totalPausedTime });
}

function calculateElapsedTime() {
    if (!startTimestamp) return 0;
    const now = Date.now();
    const elapsed = Math.floor((now - startTimestamp - totalPausedTime) / 1000);
    return Math.max(0, elapsed);
}

function pauseTimer() {
    if (!currentTask) return;
    isPaused = !isPaused;
    if (isPaused) {
        pauseTimestamp = Date.now();
    } else {
        totalPausedTime += Date.now() - pauseTimestamp;
        pauseTimestamp = null;
    }
    document.getElementById("pause-btn").textContent = isPaused ? "Resume" : "Pause";
    socket.emit('timerUpdate', { timer, isPaused, currentTask, startTimestamp, totalPausedTime });
    socket.emit('timerPaused', { timer, isPaused, currentTask, startTimestamp, totalPausedTime });
}

function finishTimer() {
    if (!currentTask) return;
    clearInterval(interval);
    timer = calculateElapsedTime();
    currentTask.end = new Date(new Date(currentTask.start).getTime() + timer * 1000);
    currentTask.duration = timer;
    document.getElementById("comment-section").style.display = "flex";
    document.getElementById("finish-btn").disabled = true;
    socket.emit('timerFinished', { timer, isPaused, currentTask, startTimestamp, totalPausedTime });
    startTimestamp = null;
    totalPausedTime = 0;
    pauseTimestamp = null;
}

function resetTimer() {
    timer = 0;
    isPaused = false;
    startTimestamp = null;
    totalPausedTime = 0;
    pauseTimestamp = null;
    clearInterval(interval);
    document.getElementById("timer").textContent = formatTime(0); // Use formatTime for consistency
    document.getElementById("pause-btn").disabled = true;
    document.getElementById("finish-btn").disabled = true;
    document.getElementById("task-text").innerHTML = "Select a Task to Begin";
    document.getElementById("suggestion").style.setProperty('--task-color', '#888888');
    document.getElementById("start-btn").disabled = true;
    document.getElementById("time-up").disabled = true;
    document.getElementById("time-down").disabled = true;
    currentTask = null;
    socket.emit('timerReset', { timer, isPaused, currentTask, startTimestamp, totalPausedTime });
}

async function saveComment() {
    if (!currentTask) {
        console.error("No current task to save comment for");
        return;
    }

    // Get the comment from the textarea
    const commentInput = document.getElementById("task-comment");
    const comment = commentInput.value.trim();

    // Add the comment to the current task
    currentTask.comment = comment;

    // Add the task to completedTasks
    try {
        // Save to the database
        const success = await saveCompletedTask(currentTask);
        if (!success) {
            throw new Error("Failed to save completed task to database");
        }

        // On successful save, add to local completedTasks array
        completedTasks.push(currentTask);

        // Update the calendar
        const scrollTop = document.getElementById("calendar").scrollTop;
        const currentView = calendar.view.type;
        const currentDate = calendar.view.activeStart;
        calendar.destroy();
        renderCalendar();
        calendar.changeView(currentView, currentDate);
        document.getElementById("calendar").scrollTop = scrollTop;

        // Update the progress box
        updateProgressBox(currentView);

        // Reset the UI
        document.getElementById("comment-section").style.display = "none";
        commentInput.value = ""; // Clear the textarea
        resetTimer();

        // Broadcast the updated completed tasks to other clients
        socket.emit('completedTasksUpdated', completedTasks);
    } catch (err) {
        console.error("Error saving completed task:", err);
        alert("Failed to save task. Please try again.");
    }
}

// Edit task name
async function editTask(index) {
    const newName = prompt("Enter new task name:", tasks[index].name);
    if (newName && newName.trim()) {
        tasks[index].name = newName.trim().split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
        await saveTasks(tasks);
        renderTasks();
        socket.emit('tasksUpdated', tasks); // Broadcast tasks update
    }
}

// Edit subtask name
async function editSubtask(taskIndex, subtaskName) {
    const newName = prompt("Enter new subtask name:", subtaskName);
    if (newName && newName.trim()) {
        const formattedName = newName.trim().split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
        const subIndex = tasks[taskIndex].subtasks.findIndex(sub => (typeof sub === "string" ? sub : sub.name) === subtaskName);
        if (typeof tasks[taskIndex].subtasks[subIndex] === "string") {
            tasks[taskIndex].subtasks[subIndex] = formattedName;
        } else {
            tasks[taskIndex].subtasks[subIndex].name = formattedName;
        }
        await saveTasks(tasks);
        renderTasks();
        socket.emit('tasksUpdated', tasks); // Broadcast tasks update
    }
}

// Delete task
async function deleteTask(index) {
    if (confirm(`Are you sure you want to delete "${tasks[index].name}"?`)) {
        tasks.splice(index, 1);
        await saveTasks(tasks);
        renderTasks();
        socket.emit('tasksUpdated', tasks); // Broadcast tasks update
    }
}

// Delete subtask
async function deleteSubtask(taskIndex, subtaskName) {
    if (confirm(`Are you sure you want to delete "${subtaskName}"?`)) {
        const subIndex = tasks[taskIndex].subtasks.findIndex(sub => (typeof sub === "string" ? sub : sub.name) === subtaskName);
        if (subIndex !== -1) {
            tasks[taskIndex].subtasks.splice(subIndex, 1);
            await saveTasks(tasks);
            renderTasks();
            socket.emit('tasksUpdated', tasks); // Broadcast tasks update
        }
    }
}

// Calendar rendering
let calendar;
function renderCalendar() {
    const calendarEl = document.getElementById("calendar");
    if (calendarEl) {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: "timeGridDay",
            headerToolbar: {
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay"
            },
            slotDuration: '00:30:00', // 30-minute slots
            slotMinTime: '00:00:00',
            slotMaxTime: '24:00:00',
            allDaySlot: false, // Disable all-day slot for cleaner display
            events: completedTasks.map((t, index) => {
                const taskInfo = tasks.find(task => task.name === t.task);
                const bgColor = taskInfo ? taskInfo.color : "#888888";
                console.log(`Mapping event: ${t.task}, Start: ${t.start}, End: ${t.end}, Duration: ${t.duration}s`);
                return {
                    title: `${t.task}${t.subtask ? " - " + t.subtask : ""}`,
                    start: new Date(t.start),
                    end: new Date(t.end),
                    backgroundColor: bgColor,
                    borderColor: bgColor,
                    textColor: "#e0e0e0",
                    extendedProps: { index, comment: t.comment, bgColor, duration: t.duration }
                };
            }),
            eventClick: function(info) {
                lastClickedTask = {
                    title: info.event.title,
                    start: info.event.start,
                    end: info.event.end,
                    comment: info.event.extendedProps.comment,
                    index: info.event.extendedProps.index,
                    duration: info.event.extendedProps.duration
                };
                updateTaskDetails();
            },
            eventContent: function(arg) {
                console.log("Rendering event:", arg.event.title, "Color:", arg.event.extendedProps.bgColor);
                return {
                    html: `
                        <div style="
                            color: #e0e0e0;
                            background: #303030;
                            border-left: 6px solid ${arg.event.extendedProps.bgColor};
                            border-radius: 8px;
                            padding: 6px 8px;
                            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                            overflow: hidden;
                            white-space: nowrap;
                            text-overflow: ellipsis;
                            display: flex;
                            align-items: center;
                            justify-content: flex-start;
                            width: 100%;
                            height: 100%; /* Allow the div to fill the event container */
                        ">${arg.event.title}</div>
                    `
                };
            },
            eventDidMount: function(info) {
                const durationSeconds = info.event.extendedProps.duration || 0;
                const slotHeight = 96; // 6em * 16px (since .fc-timegrid-slot height is 6em, assuming 1em = 16px)
                const minDurationMs = 30 * 60 * 1000; // 30 minutes in milliseconds
                const actualEnd = new Date(new Date(info.event.start).getTime() + durationSeconds * 1000);
                const minEnd = new Date(new Date(info.event.start).getTime() + minDurationMs);
                const eventEnd = durationSeconds < 30 * 60 ? minEnd : actualEnd;

                console.log(`Event ${info.event.title}: Duration ${durationSeconds}s, Start: ${info.event.start}, End: ${eventEnd}`);

                // For events shorter than 30 minutes, set a minimum height
                if (durationSeconds < 30 * 60) {
                    info.el.style.minHeight = `${slotHeight}px`;
                }
                // For all events, ensure styles are applied
                info.el.style.backgroundColor = "transparent"; // Let the custom div handle the background
                info.el.style.border = "none"; // Remove default border
            },
            viewClassNames: function(arg) {
                updateProgressBox(arg.view.type);
            }
        });
        calendar.render();
    }
}

async function deleteCalendarTask(index) {
    const taskToDelete = completedTasks[index];
    console.log('Attempting to delete task:', taskToDelete); // Debug log
    if (!taskToDelete || !taskToDelete._id) {
        console.error('Cannot delete task: Invalid index or missing _id', { index, task: taskToDelete });
        return;
    }

    try {
        // Send DELETE request to the server with encoded ID
        const response = await fetch(`/api/completed-tasks/${encodeURIComponent(taskToDelete._id)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to delete task from database: ${errorData.error}`);
        }

        // On successful deletion, update local state
        const scrollTop = document.getElementById("calendar").scrollTop;
        const currentView = calendar.view.type;
        const currentDate = calendar.view.activeStart;
        completedTasks.splice(index, 1);
        calendar.destroy();
        renderCalendar();
        calendar.changeView(currentView, currentDate);
        document.getElementById("calendar").scrollTop = scrollTop;
        updateTaskDetails();
        updateProgressBox(currentView);
        socket.emit('completedTasksUpdated', completedTasks); // Broadcast completed tasks update
    } catch (err) {
        console.error('Error deleting task:', err);
        alert('Failed to delete task. Please try again.'); // Notify user
    }
}

function updateTaskDetails() {
    const details = document.getElementById("task-details");
    if (lastClickedTask) {
        const durationH = Math.floor(lastClickedTask.duration / 3600).toString().padStart(2, "0");
        const durationM = Math.floor((lastClickedTask.duration % 3600) / 60).toString().padStart(2, "0");
        const durationS = (lastClickedTask.duration % 60).toString().padStart(2, "0");
        const durationStr = `${durationH}:${durationM}:${durationS}`;
        details.innerHTML = `
            <h3>${lastClickedTask.title}</h3>
            <p><strong>Start:</strong> ${new Date(lastClickedTask.start).toLocaleString()}</p>
            <p><strong>End:</strong> ${new Date(lastClickedTask.end).toLocaleString()}</p>
            <p><strong>Total Time:</strong> ${durationStr}</p>
            <p><strong>Comment:</strong> ${lastClickedTask.comment || "No comment provided"}</p>
            <button onclick="deleteCalendarTask(${lastClickedTask.index})">Delete Task</button>
        `;
    } else {
        details.innerHTML = `
            <h3>No Task Selected</h3>
            <p>Select a completed task from the calendar to view details.</p>
        `;
    }
}

function updateProgressBox(viewType) {
    const progressList = document.getElementById("progress-list");
    const progressTitle = document.getElementById("progress-title");
    progressList.innerHTML = "";
    const now = new Date();
    let startDate, maxSeconds, title;

    switch (viewType) {
        case "timeGridDay":
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            maxSeconds = 8 * 3600;
            title = "Daily Progress";
            break;
        case "timeGridWeek":
            startDate = new Date(now.setDate(now.getDate() - now.getDay()));
            maxSeconds = 56 * 3600;
            title = "Weekly Progress";
            break;
        case "dayGridMonth":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            maxSeconds = 224 * 3600;
            title = "Monthly Progress";
            break;
        default:
            startDate = new Date(now.setDate(now.getDate() - now.getDay()));
            maxSeconds = 56 * 3600;
            title = "Weekly Progress";
    }

    progressTitle.textContent = title;

    const periodTasks = completedTasks.filter(t => new Date(t.start) >= startDate);
    const taskProgress = {};
    periodTasks.forEach(t => {
        const key = `${t.task}${t.subtask ? " - " + t.subtask : ""}`;
        if (!taskProgress[key]) {
            const taskInfo = tasks.find(task => task.name === t.task);
            taskProgress[key] = { completed: 0, suggested: t.time, color: taskInfo ? taskInfo.color : "#888888" };
        }
        taskProgress[key].completed += t.duration;
    });

    const pixelsPerSecond = 1200 / maxSeconds;
    for (const [task, data] of Object.entries(taskProgress)) {
        const completedPixels = Math.min(data.completed * pixelsPerSecond, 1200);
        const suggestedPixels = Math.min(data.suggested * pixelsPerSecond, 1200);
        const progressItem = document.createElement("div");
        progressItem.className = "progress-item";
        progressItem.innerHTML = `
            <span>${task}</span>
            <div class="progress-bar">
                <div class="suggested" style="width: ${suggestedPixels}px; background: ${data.color}; opacity: 0.5;"></div>
                <div class="completed" style="width: ${completedPixels}px; background: ${data.color};"></div>
            </div>
        `;
        progressList.appendChild(progressItem);
    }
}

// Weekly report
function generateWeeklyReport() {
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    const weekTasks = completedTasks.filter(t => new Date(t.start) >= weekStart);
    const totalTime = weekTasks.reduce((sum, t) => sum + t.duration, 0) / 3600;
    const exerciseCount = weekTasks.filter(t => t.task === "Exercise").length;

    let report = `
        Weekly Report (Week of ${weekStart.toDateString()}):
        - Total Hours: ${totalTime.toFixed(2)} / 40 (Goal: 8 hours/day x 5 days)
        - Exercise Sessions: ${exerciseCount} (Goal: 1/day)
        Suggestions:
        - ${totalTime < 40 ? "Increase daily activity to meet 8-hour goal." : "Great job meeting your time goal!"}
        - ${exerciseCount < 5 ? "Try to fit in more Exercise sessions." : "Excellent consistency with Exercise!"}
        Task Progress:
    `;

    const taskProgress = {};
    weekTasks.forEach(t => {
        const key = `${t.task}${t.subtask ? " - " + t.subtask : ""}`;
        if (!taskProgress[key]) {
            taskProgress[key] = { completed: 0, suggested: t.time };
        }
        taskProgress[key].completed += t.duration;
    });

    for (const [task, data] of Object.entries(taskProgress)) {
        const completedH = Math.floor(data.completed / 3600);
        const completedM = Math.floor((data.completed % 3600) / 60);
        const suggestedH = Math.floor(data.suggested / 3600);
        const suggestedM = Math.floor((data.suggested % 3600) / 60);
        report += `\n- ${task}: Completed ${completedH}h ${completedM}m / Suggested ${suggestedH}h ${suggestedM}m`;
    }

    report += "\nTask Comments:";
    weekTasks.forEach(t => {
        if (t.comment) report += `\n- ${t.task}${t.subtask ? " - " + t.subtask : ""}: ${t.comment}`;
    });

    console.log(report);
    if (now.getDay() === 1) tasks.forEach(t => t.prob = 1);
}

// Add subtask (popup)
function addSubtask(index) {
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.innerHTML = `
        <div class="popup-content">
            <h3>Add New Subtask</h3>
            <input type="text" id="new-subtask-input" placeholder="Enter subtask name...">
            <button onclick="saveNewSubtask(${index})">Add</button>
            <button onclick="closePopup(this)">Cancel</button>
        </div>
    `;
    document.body.appendChild(popup);
}

async function saveNewSubtask(taskIndex) {
    const input = document.getElementById("new-subtask-input");
    const subtaskName = input.value.trim().split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
    if (subtaskName) {
        tasks[taskIndex].subtasks.push(subtaskName);
        await saveTasks(tasks);
        renderTasks();
        closePopup(document.querySelector('.popup .popup-content button:nth-child(3)')); // Close popup
        toggleSubtasks(taskIndex, true); // Keep subtasks dropdown open
        socket.emit('tasksUpdated', tasks); // Broadcast tasks update
    } else {
        console.error("Subtask name is empty or invalid after trimming");
        alert("Please enter a valid subtask name."); // Notify user for better UX
    }
}

// Add task (popup, revert to working state)
function showAddTaskPopup() {
    // Check if a popup already exists to prevent duplicates
    if (document.querySelector('.popup')) {
        console.warn("Popup already exists, closing existing one.");
        closePopup(document.querySelector('.popup .popup-content button:nth-child(3)'));
    }
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.innerHTML = `
        <div class="popup-content">
            <h3>Add New Task</h3>
            <input type="text" id="new-task-input" placeholder="Enter task name...">
            <button onclick="saveNewTask()">Add</button>
            <button onclick="closePopup(this)">Cancel</button>
        </div>
    `;
    document.body.appendChild(popup);
}

async function saveNewTask() {
    const input = document.getElementById("new-task-input");
    const taskName = input.value.trim().split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
    if (taskName) {
        const taskList = document.getElementById("task-list");
        if (!taskList) {
            console.error("Task list element not found");
            return;
        }
        const addTaskLi = taskList.querySelector("li:last-child"); // Find the "Add Task" li
        const newTask = {
            name: taskName,
            subtasks: [],
            prob: 1,
            color: `#${Math.floor(Math.random() * 16777215).toString(16)}`
        };
        tasks.splice(tasks.length - 1, 0, newTask); // Insert before the last (Add Task) element
        await saveTasks(tasks);
        renderTasks(); // Ensure UI updates immediately
        closePopup(document.querySelector('.popup .popup-content button:nth-child(3)')); // Close popup
        socket.emit('tasksUpdated', tasks); // Broadcast tasks update
    } else {
        console.error("Task name is empty or invalid after trimming");
        alert("Please enter a valid task name."); // Notify user for better UX
    }
}

function closePopup(button) {
    const popup = button.closest('.popup');
    if (popup) {
        popup.remove(); // Ensure popup is removed from DOM
    }
}

// Render task list (ensure single "+" button for Add Task, no duplicates)
function renderTasks() {
    const taskList = document.getElementById("task-list");
    if (!taskList) {
        console.error("Task list element not found");
        return;
    }
    taskList.innerHTML = "";
    tasks.forEach((task, index) => {
        if (index < tasks.length - 1) { // Skip the last element (Add Task)
            console.log("Rendering task:", task.name);
            const li = document.createElement("li");
            li.style.setProperty('--task-color', task.color);
            li.innerHTML = `
                <div class="task-header">
                    <span onclick="toggleSubtasks(${index}, true); selectTask('${task.name}')">${task.name}</span>
                    <div class="buttons">
                        <button class="edit" onclick="editTask(${index})">E</button>
                        <button class="delete" onclick="deleteTask(${index})">X</button>
                    </div>
                </div>
            `;
            const ul = document.createElement("ul");
            ul.id = `subtasks-${index}`;
            ul.className = "subtasks";
            task.subtasks.forEach(sub => {
                const subName = typeof sub === "string" ? sub : sub.name;
                const subLi = document.createElement("li");
                subLi.innerHTML = `
                    <div class="subtask-header">
                        <span onclick="selectTask('${task.name}', '${subName}')">${subName}</span>
                        <div class="buttons">
                            <button class="edit" onclick="editSubtask(${index}, '${subName}')">E</button>
                            <button class="delete" onclick="deleteSubtask(${index}, '${subName}')">X</button>
                        </div>
                    </div>
                `;
                ul.appendChild(subLi);
            });
            const addLi = document.createElement("li");
            addLi.innerHTML = `
                <div class="subtask-header">
                    <span></span> <!-- Empty span for alignment -->
                    <button class="add-subtask" onclick="addSubtask(${index})">+</button>
                </div>
            `;
            ul.appendChild(addLi);
            li.appendChild(ul);
            taskList.appendChild(li);
        }
    });
    // Add only one "+" button for Add Task at the bottom of the task list
    const addTaskLi = document.createElement("li");
    addTaskLi.innerHTML = `
        <div class="task-header">
            <span></span> <!-- Empty span for alignment -->
            <button class="add-task-button" onclick="showAddTaskPopup()">+</button>
        </div>
    `;
    taskList.appendChild(addTaskLi);

    // Ensure only one event listener for .add-task-button
    const addTaskButton = taskList.querySelector('.add-task-button');
    if (addTaskButton) {
        // Remove any existing listeners to prevent duplicates
        const oldElement = addTaskButton.cloneNode(true);
        addTaskButton.parentNode.replaceChild(oldElement, addTaskButton);
        oldElement.addEventListener('click', showAddTaskPopup);
    }
}

// Toggle subtasks (ensure state is maintained)
function toggleSubtasks(index, collapseOthers = false) {
    const subtasks = document.getElementById(`subtasks-${index}`);
    if (subtasks) {
        const isActive = subtasks.classList.contains("active");
        if (collapseOthers) {
            document.querySelectorAll('.subtasks.active').forEach(el => {
                if (el !== subtasks) el.classList.remove("active");
            });
        }
        subtasks.classList.toggle("active", !isActive);
    }
}

// Sync state from localStorage (temporary)
function loadState() {
    const savedTask = localStorage.getItem("currentTask");
    if (savedTask) {
        currentTask = JSON.parse(savedTask);
        timer = parseInt(localStorage.getItem("timer")) || 0;
        isPaused = localStorage.getItem("isPaused") === "true";
        document.getElementById("task-text").innerHTML = `${currentTask.task}${currentTask.subtask ? " - " + currentTask.subtask : ""} (${currentTask.time / 60} hours)`;
        document.getElementById("suggestion").style.setProperty('--task-color', currentTask.color);
        document.getElementById("timer").textContent = formatTime(timer);
        document.getElementById("start-btn").disabled = true;
        document.getElementById("pause-btn").disabled = false;
        document.getElementById("finish-btn").disabled = false;
        document.getElementById("pause-btn").textContent = isPaused ? "Resume" : "Pause";
        if (!isPaused) {
            interval = setInterval(() => {
                timer++;
                document.getElementById("timer").textContent = formatTime(timer);
                socket.emit('timerUpdate', { timer, isPaused, currentTask }); // Broadcast timer update
            }, 1000);
        }
    }
    socket.emit('stateLoaded', { timer, isPaused, currentTask }); // Broadcast initial state to sync
}

// Event listeners
document.getElementById("task-btn").addEventListener("click", () => generateTask());
document.getElementById("start-btn").addEventListener("click", startTimer);
document.getElementById("pause-btn").addEventListener("click", pauseTimer);
document.getElementById("finish-btn").addEventListener("click", finishTimer);
document.getElementById("time-up").addEventListener("click", () => adjustTime("up"));
document.getElementById("time-down").addEventListener("click", () => adjustTime("down"));

// Initial setup
Promise.all([fetchTasks(), fetchCompletedTasks()]).then(([taskData, completedData]) => {
    console.log('Initial tasks from DB:', taskData);
    console.log('Initial completed tasks from DB:', completedData);
    tasks = taskData.length ? taskData : tasks;
    completedTasks = completedData.length ? completedData : [];
    renderTasks();
    renderCalendar();
    loadState();
}).catch(err => {
    console.error('Initial fetch failed:', err);
    renderTasks();
    renderCalendar();
    loadState();
    setTimeout(() => {
        fetchTasks().then(data => {
            tasks = data.length ? data : tasks;
            renderTasks();
            socket.emit('tasksUpdated', tasks); // Broadcast tasks update
        });
        fetchCompletedTasks().then(data => {
            completedTasks = data.length ? data : [];
            renderCalendar();
            updateProgressBox('timeGridDay');
            socket.emit('completedTasksUpdated', completedTasks); // Broadcast completed tasks update
        });
    }, 5000);
});

// Socket.IO listeners for live syncing
socket.on('timerUpdate', (data) => {
    if (data.currentTask && (!currentTask || data.currentTask.task === currentTask.task && data.currentTask.subtask === currentTask.subtask)) {
        timer = data.timer;
        isPaused = data.isPaused;
        currentTask = data.currentTask || currentTask;
        startTimestamp = data.startTimestamp || startTimestamp;
        totalPausedTime = data.totalPausedTime || totalPausedTime;

        document.getElementById("timer").textContent = formatTime(timer);
        document.getElementById("pause-btn").textContent = isPaused ? "Resume" : "Pause";
        document.getElementById("pause-btn").disabled = false;
        document.getElementById("finish-btn").disabled = false;
        document.getElementById("start-btn").disabled = true;
        document.getElementById("task-text").innerHTML = `${currentTask.task}${currentTask.subtask ? " - " + currentTask.subtask : ""} (${currentTask.time / 60} hours)`;
        document.getElementById("suggestion").style.setProperty('--task-color', currentTask.color);

        if (interval) clearInterval(interval);
        if (!isPaused && startTimestamp) {
            interval = setInterval(() => {
                timer = calculateElapsedTime();
                document.getElementById("timer").textContent = formatTime(timer);
                socket.emit('timerUpdate', { timer, isPaused, currentTask, startTimestamp, totalPausedTime });
            }, 1000);
        }
    }
});

socket.on('timerStarted', (data) => {
    if (data.currentTask && (!currentTask || data.currentTask.task === currentTask.task && data.currentTask.subtask === currentTask.subtask)) {
        timer = data.timer;
        isPaused = data.isPaused;
        currentTask = data.currentTask || currentTask;
        startTimestamp = data.startTimestamp || startTimestamp;
        totalPausedTime = data.totalPausedTime || totalPausedTime;

        document.getElementById("timer").textContent = formatTime(timer);
        document.getElementById("pause-btn").textContent = isPaused ? "Resume" : "Pause";
        document.getElementById("pause-btn").disabled = false;
        document.getElementById("finish-btn").disabled = false;
        document.getElementById("start-btn").disabled = true;
        document.getElementById("task-text").innerHTML = `${currentTask.task}${currentTask.subtask ? " - " + currentTask.subtask : ""} (${currentTask.time / 60} hours)`;
        document.getElementById("suggestion").style.setProperty('--task-color', currentTask.color);

        if (interval) clearInterval(interval);
        if (!isPaused && startTimestamp) {
            interval = setInterval(() => {
                timer = calculateElapsedTime();
                document.getElementById("timer").textContent = formatTime(timer);
                socket.emit('timerUpdate', { timer, isPaused, currentTask, startTimestamp, totalPausedTime });
            }, 1000);
        }
    }
});

socket.on('timerPaused', (data) => {
    if (data.currentTask && (!currentTask || data.currentTask.task === currentTask.task && data.currentTask.subtask === currentTask.subtask)) {
        isPaused = data.isPaused;
        timer = data.timer;
        startTimestamp = data.startTimestamp || startTimestamp;
        totalPausedTime = data.totalPausedTime || totalPausedTime;

        document.getElementById("pause-btn").textContent = isPaused ? "Resume" : "Pause";
        if (interval) clearInterval(interval);
        if (!isPaused && startTimestamp) {
            interval = setInterval(() => {
                timer = calculateElapsedTime();
                document.getElementById("timer").textContent = formatTime(timer);
                socket.emit('timerUpdate', { timer, isPaused, currentTask, startTimestamp, totalPausedTime });
            }, 1000);
        }
    }
});

socket.on('timerFinished', (data) => {
    if (data.currentTask && (!currentTask || data.currentTask.task === currentTask.task && data.currentTask.subtask === currentTask.subtask)) {
        clearInterval(interval);
        timer = data.timer;
        isPaused = data.isPaused;
        currentTask = data.currentTask || currentTask;
        startTimestamp = data.startTimestamp || startTimestamp;
        totalPausedTime = data.totalPausedTime || totalPausedTime;

        currentTask.end = new Date(new Date(currentTask.start).getTime() + timer * 1000);
        currentTask.duration = timer;
        document.getElementById("timer").textContent = formatTime(timer);
        document.getElementById("pause-btn").disabled = true;
        document.getElementById("finish-btn").disabled = true;
        document.getElementById("comment-section").style.display = "flex";
        document.getElementById("task-text").innerHTML = `${currentTask.task}${currentTask.subtask ? " - " + currentTask.subtask : ""} (${currentTask.time / 60} hours)`;
        document.getElementById("suggestion").style.setProperty('--task-color', currentTask.color);
    }
});

socket.on('timerReset', (data) => {
    timer = 0;
    isPaused = false;
    currentTask = null;
    startTimestamp = null;
    totalPausedTime = 0;
    pauseTimestamp = null;
    document.getElementById("timer").textContent = "00:00:00";
    document.getElementById("pause-btn").disabled = true;
    document.getElementById("finish-btn").disabled = true;
    document.getElementById("task-text").innerHTML = "Select a Task to Begin";
    document.getElementById("suggestion").style.setProperty('--task-color', '#888888');
    document.getElementById("start-btn").disabled = true;
    document.getElementById("time-up").disabled = true;
    document.getElementById("time-down").disabled = true;
    if (interval) clearInterval(interval);
});

socket.on('stateLoaded', (data) => {
    timer = data.timer;
    isPaused = data.isPaused;
    currentTask = data.currentTask;
    startTimestamp = data.startTimestamp || null;
    totalPausedTime = data.totalPausedTime || 0;

    document.getElementById("timer").textContent = formatTime(timer);
    document.getElementById("pause-btn").textContent = isPaused ? "Resume" : "Pause";
    document.getElementById("task-text").innerHTML = currentTask ? `${currentTask.task}${currentTask.subtask ? " - " + currentTask.subtask : ""} (${currentTask.time / 60} hours)` : "Select a Task to Begin";
    document.getElementById("suggestion").style.setProperty('--task-color', currentTask ? currentTask.color : '#888888');
    document.getElementById("start-btn").disabled = !currentTask || isPaused;
    document.getElementById("pause-btn").disabled = !currentTask;
    document.getElementById("finish-btn").disabled = !currentTask || isPaused;
    document.getElementById("time-up").disabled = !currentTask;
    document.getElementById("time-down").disabled = !currentTask;

    if (interval) clearInterval(interval);
    if (currentTask && !isPaused && startTimestamp) {
        interval = setInterval(() => {
            timer = calculateElapsedTime();
            document.getElementById("timer").textContent = formatTime(timer);
            socket.emit('timerUpdate', { timer, isPaused, currentTask, startTimestamp, totalPausedTime });
        }, 1000);
    }
});


// --- Responsive Swipe Logic ---

function initializeMobileSwipe() {
    // Only add listeners if potentially on a touch device (basic check)
    if (!('ontouchstart' in window)) {
       console.log("Touch events not detected, skipping swipe initialization.");
       return;
    }
    console.log("Initializing mobile swipe detection.");

   // Select the element where swipes should be detected (usually the main content area)
   const mainContentArea = document.querySelector('.main-content');
   const body = document.body; // We'll add classes to the body

   if (!mainContentArea) {
       console.error("Swipe initialization failed: .main-content area not found.");
       return;
   }

   let touchStartX = 0;
   let touchEndX = 0;
   let touchStartY = 0;
   let touchEndY = 0;
   let isSwiping = false; // Flag to ensure touchmove/touchend correlate to a valid touchstart

   // --- Main Gesture Handler (SWAPPED DIRECTIONS) ---
   function handleGesture() {
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const swipeThreshold = 50; // Minimum horizontal distance for a swipe
    const tapThreshold = 20; // Maximum movement for a tap

    // Check 1: Is the movement predominantly horizontal and meets the threshold?
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > swipeThreshold) {
        if (deltaX < -swipeThreshold) {
            // *** SWIPE LEFT: Show CALENDAR, Hide Sidebar ***
            console.log("Swipe Left Detected (Show Calendar)");
            if (body.classList.contains('show-sidebar')) {
                body.classList.remove('show-sidebar');
            } else if (!body.classList.contains('show-calendar')) {
                body.classList.add('show-calendar');
                // IMPORTANT: Trigger calendar resize after the panel is likely visible
                if (typeof calendar !== 'undefined' && calendar && typeof calendar.updateSize === 'function') {
                    // Delay matches the CSS transition duration
                    setTimeout(() => {
                        console.log("Updating calendar size after swipe left.");
                        calendar.updateSize();
                    }, 350);
                }
            }
        } else if (deltaX > swipeThreshold) {
            // *** SWIPE RIGHT: Show SIDEBAR, Hide Calendar ***
            console.log("Swipe Right Detected (Show Sidebar)");
            if (body.classList.contains('show-calendar')) {
                body.classList.remove('show-calendar');
            } else if (!body.classList.contains('show-sidebar')) {
                body.classList.add('show-sidebar');
            }
        }
    }
    // Check 2: Was it a minimal movement (tap)? Close open panels if tapped outside.
    else if (Math.abs(deltaX) < tapThreshold && Math.abs(deltaY) < tapThreshold) {
         // (This part remains the same - closes any open panel on tap outside)
         if (body.classList.contains('show-sidebar') || body.classList.contains('show-calendar')) {
              const sidebar = document.querySelector('.sidebar');
              const calendarEl = document.getElementById('calendar');
              let target = event.target;
              let tappedOutsidePanel = true;

              if (body.classList.contains('show-sidebar') && sidebar && sidebar.contains(target)) {
                    tappedOutsidePanel = false;
              }
              if (body.classList.contains('show-calendar') && calendarEl && calendarEl.contains(target)) {
                    tappedOutsidePanel = false;
              }

              if (tappedOutsidePanel) {
                 console.log("Tap outside open panel detected, closing panels.");
                 body.classList.remove('show-sidebar');
                 body.classList.remove('show-calendar');
              }
         }
    }
} // --- End of modified handleGesture ---

   // --- Event Listeners ---

   mainContentArea.addEventListener('touchstart', (e) => {
       const sidebar = document.querySelector('.sidebar');
       const calendarEl = document.getElementById('calendar');

       // IMPORTANT: Prevent swipe initiation if the touch starts *inside* an already open panel.
       // This allows scrolling within the panel itself.
       if ((body.classList.contains('show-sidebar') && sidebar && sidebar.contains(e.target)) ||
           (body.classList.contains('show-calendar') && calendarEl && calendarEl.contains(e.target))) {
           isSwiping = false; // Do not start a swipe gesture
           // console.log("Touch started inside an open panel, swipe ignored.");
           return;
       }

       // Record starting coordinates if touch is in the main area
       touchStartX = e.changedTouches[0].screenX;
       touchStartY = e.changedTouches[0].screenY;
       isSwiping = true; // Okay to start tracking swipe gesture
       // console.log("Touch Start:", touchStartX, touchStartY);
   }, { passive: true }); // Use passive: true for better scroll performance

   mainContentArea.addEventListener('touchmove', (e) => {
       // Only track movement if a valid swipe gesture was started
       if (!isSwiping) return;

       // Record current coordinates
       touchEndX = e.changedTouches[0].screenX;
       touchEndY = e.changedTouches[0].screenY;
       // console.log("Touch Move:", touchEndX, touchEndY);
   }, { passive: true });

   mainContentArea.addEventListener('touchend', (e) => {
       // Only process touchend if a valid swipe gesture was started
       if (!isSwiping) return;

       // Record final coordinates (touchEndX/Y might not be updated if touchmove didn't fire)
       touchEndX = e.changedTouches[0].screenX;
       touchEndY = e.changedTouches[0].screenY;
       // console.log("Touch End:", touchEndX, touchEndY);

       // Determine the gesture
       handleGesture();

       // Reset state for the next touch
       isSwiping = false;
       touchStartX = 0;
       touchEndX = 0;
       touchStartY = 0;
       touchEndY = 0;
   });

    // Optional: Add listener to close panels if window resizes from mobile to desktop view
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) { // Use the same breakpoint as your CSS media query
            if(body.classList.contains('show-sidebar') || body.classList.contains('show-calendar')) {
                console.log("Resized to desktop width, closing mobile panels.");
                body.classList.remove('show-sidebar');
                body.classList.remove('show-calendar');
            }
        }
    });

     // --- Optional: Enhance Calendar Interaction on Mobile ---
     // If your calendar instance is globally accessible (e.g., as 'calendar'),
     // you can modify its eventClick handler
     if (typeof calendar !== 'undefined' && calendar) {
         // This assumes you re-initialize or update calendar options somewhere in your code.
         // You might need to integrate this into your existing calendar setup logic.
         // Example:
         /*
         calendar.setOption('eventClick', function(info) {
             console.log('Event Clicked (Mobile Enhanced):', info.event);
             // Call your existing function to display details
             displayTaskDetails(info.event.extendedProps.taskId);

             // On mobile screens, automatically close the calendar panel after clicking an event
             if (window.innerWidth <= 768 && document.body.classList.contains('show-calendar')) {
                console.log("Closing calendar panel after event click on mobile.");
                document.body.classList.remove('show-calendar');
             }
         });
         */
         // Note: Directly modifying options like this might vary depending on how you initialize FullCalendar.
         // It might be better to include this logic within the options object during initialization.
     }

} // --- End of initializeMobileSwipe ---


// --- Initialization ---
// Make sure this initialization runs after the DOM is loaded
// and after your FullCalendar instance (the global 'calendar' variable) is created.
document.addEventListener('DOMContentLoaded', () => {
   // --- Keep all your existing DOMContentLoaded code here ---

   // Call the swipe initializer
   // It might need to be called slightly later if 'calendar' isn't ready yet.
   // A small timeout can sometimes help, or place it after calendar.render().
   setTimeout(initializeMobileSwipe, 100); // Small delay to ensure other elements are ready
});

// --- Make sure you have your FullCalendar instance available globally ---
// Example: Declare it outside functions if needed by the swipe logic
// let calendar;
// function renderCalendar() {
//    const calendarEl = document.getElementById('calendar');
//    // ... other setup ...
//    calendar = new FullCalendar.Calendar(calendarEl, { /* options */ }); // Assign to global var
//    calendar.render();
// }