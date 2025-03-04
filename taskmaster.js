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
        console.log('Fetched completed tasks:', data);
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
}

// Time adjustment
function adjustTime(direction) {
    if (!currentTask) return;
    const increment = direction === "up" ? 30 : -30;
    currentTask.time = Math.max(30, currentTask.time + increment);
    document.getElementById("task-text").innerHTML = `${currentTask.task}${currentTask.subtask ? " - " + currentTask.subtask : ""} (${currentTask.time / 60} hours)`;
}

// Timer functionality
function startTimer() {
    currentTask.start = new Date();
    interval = setInterval(() => {
        if (!isPaused) {
            timer++;
            document.getElementById("timer").textContent = formatTime(timer);
            socket.emit('timerUpdate', { timer, isPaused, currentTask });
        }
    }, 1000);
    document.getElementById("pause-btn").disabled = false;
    document.getElementById("finish-btn").disabled = false;
    document.getElementById("start-btn").disabled = true;
}

function pauseTimer() {
    isPaused = !isPaused;
    document.getElementById("pause-btn").textContent = isPaused ? "Resume" : "Pause";
    socket.emit('timerUpdate', { timer, isPaused, currentTask });
}

function finishTimer() {
    clearInterval(interval);
    currentTask.end = new Date();
    currentTask.duration = timer;
    document.getElementById("comment-section").style.display = "flex";
    document.getElementById("finish-btn").disabled = true;
}

async function saveComment() {
    currentTask.comment = document.getElementById("task-comment").value;
    await saveCompletedTask(currentTask); // Save to DB first
    tasks.find(t => t.name === currentTask.task).prob = Math.max(0.1, tasks.find(t => t.name === currentTask.task).prob * 0.8);
    await saveTasks(tasks); // Then save tasks with updated prob
    const updatedCompletedTasks = await fetchCompletedTasks(); // Fetch latest completed tasks
    completedTasks = updatedCompletedTasks.length ? updatedCompletedTasks : completedTasks;
    resetTimer();
    document.getElementById("comment-section").style.display = "none";
    document.getElementById("task-comment").value = "";
    const currentView = calendar ? calendar.view.type : 'timeGridDay';
    const currentDate = calendar ? calendar.view.activeStart : new Date();
    if (calendar) calendar.destroy();
    renderCalendar();
    calendar.changeView(currentView, currentDate);
    updateTaskDetails();
    updateProgressBox(currentView);
}

function resetTimer() {
    timer = 0;
    isPaused = false;
    document.getElementById("timer").textContent = "00:00:00";
    document.getElementById("pause-btn").disabled = true;
    document.getElementById("finish-btn").disabled = true;
    document.getElementById("task-text").innerHTML = "Select a Task to Begin";
    document.getElementById("suggestion").style.setProperty('--task-color', '#888888');
    document.getElementById("start-btn").disabled = true;
    document.getElementById("time-up").disabled = true;
    document.getElementById("time-down").disabled = true;
    currentTask = null;
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
}

// Edit task name
async function editTask(index) {
    const newName = prompt("Enter new task name:", tasks[index].name);
    if (newName && newName.trim()) {
        tasks[index].name = newName.trim().split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
        await saveTasks(tasks);
        renderTasks();
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
    }
}

// Delete task
async function deleteTask(index) {
    if (confirm(`Are you sure you want to delete "${tasks[index].name}"?`)) {
        tasks.splice(index, 1);
        await saveTasks(tasks);
        renderTasks();
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
        }
    }
}

// Calendar rendering
let calendar;
function renderCalendar() {
    const calendarEl = document.getElementById("calendar");
    const scrollTop = calendarEl.scrollTop;
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "timeGridDay",
        headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay"
        },
        slotDuration: '00:30:00',
        events: completedTasks.map((t, index) => {
            const taskInfo = tasks.find(task => task.name === t.task);
            const bgColor = taskInfo ? taskInfo.color : "#888888";
            return {
                title: `${t.task}${t.subtask ? " - " + t.subtask : ""}`,
                start: t.start,
                end: t.end,
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
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: flex-start;
                    ">${arg.event.title}</div>
                `
            };
        },
        viewClassNames: function(arg) {
            updateProgressBox(arg.view.type);
        }
    });
    calendar.render();
    calendarEl.scrollTop = scrollTop;
    updateProgressBox(calendar.view.type);
}

function deleteCalendarTask(index) {
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
    }
}

// Add task (popup, matching Add Subtask, insert above Add Task box)
function showAddTaskPopup() {
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
    if (taskName) { // Check if taskName is not empty after trimming
        const taskList = document.getElementById("task-list");
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
    } else {
        console.error("Task name is empty or invalid after trimming");
        alert("Please enter a valid task name."); // Notify user for better UX
    }
}

function closePopup(button) {
    const popup = button.closest('.popup');
    if (popup) popup.remove();
}

// Render task list (update to use only one "+" button for Add Task at the bottom)
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
}

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
                if (!isPaused) {
                    timer++;
                    document.getElementById("timer").textContent = formatTime(timer);
                    socket.emit('timerUpdate', { timer, isPaused, currentTask });
                }
            }, 1000);
        }
    }
}

// Event listeners
document.getElementById("task-btn").addEventListener("click", () => generateTask());
document.getElementById("start-btn").addEventListener("click", startTimer);
document.getElementById("pause-btn").addEventListener("click", pauseTimer);
document.getElementById("finish-btn").addEventListener("click", finishTimer);
document.getElementById("time-up").addEventListener("click", () => adjustTime("up"));
document.getElementById("time-down").addEventListener("click", () => adjustTime("down"));
// No need for separate event listener for .add-task-button here, as it's handled in renderTasks

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
        });
        fetchCompletedTasks().then(data => {
            completedTasks = data.length ? data : [];
            renderCalendar();
            updateProgressBox('timeGridDay');
        });
    }, 5000);
});

// Socket.IO listeners
socket.on('tasksUpdated', (updatedTasks) => {
    tasks = updatedTasks;
    renderTasks();
});

socket.on('completedTasksUpdated', (updatedCompletedTasks) => {
    completedTasks = updatedCompletedTasks;
    renderCalendar();
    updateProgressBox(calendar ? calendar.view.type : 'timeGridDay');
});

socket.on('timerUpdate', (data) => {
    if (currentTask && data.currentTask.task === currentTask.task && data.currentTask.subtask === currentTask.subtask) {
        timer = data.timer;
        isPaused = data.isPaused;
        document.getElementById("timer").textContent = formatTime(timer);
        document.getElementById("pause-btn").textContent = isPaused ? "Resume" : "Pause";
        document.getElementById("pause-btn").disabled = false;
        document.getElementById("finish-btn").disabled = false;
        document.getElementById("start-btn").disabled = true;
    }
});

setInterval(() => {
    if (new Date().getDay() === 1 && new Date().getHours() === 8) generateWeeklyReport();
}, 3600000);