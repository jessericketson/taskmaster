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
let isPaused = true;
let completedTasks = [];
let lastClickedTask = null;
let calendar;

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
    if (!response.ok) throw new Error('Failed to fetch tasks');
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
    if (!response.ok) throw new Error('Failed to fetch completed tasks');
    const data = await response.json();
    console.log('Fetched completed tasks with IDs:', data);
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
    console.log('Saved completed task response:', data);
    return true;
  } catch (err) {
    console.error('Error saving completed task:', err);
    return false;
  }
}

// Random task generator
function generateTask() {
  if (tasks.length === 0) {
    document.getElementById("task-text").innerHTML = "No Tasks Available";
    return;
  }
  const validTasks = tasks.filter(task => task && "name" in task);
  if (validTasks.length === 0) {
    document.getElementById("task-text").innerHTML = "No Valid Tasks Available";
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
  let subtask = selectedTask.subtasks.length ? selectedTask.subtasks[Math.floor(Math.random() * selectedTask.subtasks.length)] : "";
  const subtaskName = typeof subtask === "object" && subtask ? subtask.name : (typeof subtask === "string" ? subtask : "");
  const time = 30 * (1 + Math.floor(Math.random() * 6));
  currentTask = { task: selectedTask.name, subtask: subtaskName, time, start: null, end: null, comment: "", color: selectedTask.color };
  document.getElementById("task-text").innerHTML = `${selectedTask.name}${subtaskName ? " - " + subtaskName : ""} (${time / 60} hours)`;
  document.getElementById("suggestion").style.setProperty('--task-color', selectedTask.color);
  document.getElementById("start-btn").disabled = false;
  document.getElementById("time-up").disabled = false;
  document.getElementById("time-down").disabled = false;
  socket.emit('taskGenerated', currentTask);
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
  socket.emit('taskSelected', currentTask);
}

// Time adjustment
function adjustTime(direction) {
  if (!currentTask) return;
  const increment = direction === "up" ? 30 : -30;
  currentTask.time = Math.max(30, currentTask.time + increment);
  document.getElementById("task-text").innerHTML = `${currentTask.task}${currentTask.subtask ? " - " + currentTask.subtask : ""} (${currentTask.time / 60} hours)`;
  socket.emit('taskAdjusted', currentTask);
}

// Timer functionality (server-driven)
function startTimer() {
  if (!currentTask) return;
  socket.emit('startTimer', currentTask);
}

function pauseTimer() {
  socket.emit('pauseTimer');
}

function finishTimer() {
    socket.emit('finishTimer');
    showCommentSection(); // Call a helper function to ensure visibility
  }
  
  function showCommentSection() {
    const commentSection = document.getElementById("comment-section");
    if (commentSection) {
      commentSection.style.display = "flex";
      commentSection.style.opacity = "0"; // Reset opacity for fade-in effect
      setTimeout(() => {
        commentSection.style.opacity = "1"; // Fade in after ensuring display
      }, 10); // Small delay to trigger repaint
    } else {
      console.error("Comment section element not found in DOM");
    }
  }

function resetTimer() {
  socket.emit('resetTimer');
  document.getElementById("comment-section").style.display = "none";
  document.getElementById("task-comment").value = "";
}

async function saveComment() {
    if (!currentTask) return;
    const commentInput = document.getElementById("task-comment");
    currentTask.comment = commentInput.value.trim();
    try {
      const success = await saveCompletedTask(currentTask);
      if (!success) throw new Error("Failed to save completed task");
      // Do not push locally; wait for server update
      const scrollTop = document.getElementById("calendar").scrollTop;
      const currentView = calendar.view.type;
      const currentDate = calendar.view.activeStart;
      // Calendar will be updated via socket event, no local push here
      document.getElementById("comment-section").style.display = "none";
      commentInput.value = "";
      resetTimer();
      // Socket event will handle the update, no need to emit here
    } catch (err) {
      console.error("Error saving completed task:", err);
      alert("Failed to save task. Please try again.");
    }
  }

// Edit and delete functions (unchanged)
async function editTask(index) {
  const newName = prompt("Enter new task name:", tasks[index].name);
  if (newName && newName.trim()) {
    tasks[index].name = newName.trim().split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
    await saveTasks(tasks);
    renderTasks();
    socket.emit('tasksUpdated', tasks);
  }
}

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
    socket.emit('tasksUpdated', tasks);
  }
}

async function deleteTask(index) {
  if (confirm(`Are you sure you want to delete "${tasks[index].name}"?`)) {
    tasks.splice(index, 1);
    await saveTasks(tasks);
    renderTasks();
    socket.emit('tasksUpdated', tasks);
  }
}

async function deleteSubtask(taskIndex, subtaskName) {
  if (confirm(`Are you sure you want to delete "${subtaskName}"?`)) {
    const subIndex = tasks[taskIndex].subtasks.findIndex(sub => (typeof sub === "string" ? sub : sub.name) === subtaskName);
    if (subIndex !== -1) {
      tasks[taskIndex].subtasks.splice(subIndex, 1);
      await saveTasks(tasks);
      renderTasks();
      socket.emit('tasksUpdated', tasks);
    }
  }
}

// Calendar rendering
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
      slotDuration: '00:30:00',
      slotMinTime: '00:00:00',
      slotMaxTime: '24:00:00',
      allDaySlot: false,
      events: completedTasks.map((t, index) => {
        const taskInfo = tasks.find(task => task.name === t.task);
        const bgColor = taskInfo ? taskInfo.color : "#888888";
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
              height: 100%;
            ">${arg.event.title}</div>
          `
        };
      },
      eventDidMount: function(info) {
        const durationSeconds = info.event.extendedProps.duration || 0;
        const slotHeight = 96;
        const minDurationMs = 30 * 60 * 1000;
        const actualEnd = new Date(new Date(info.event.start).getTime() + durationSeconds * 1000);
        const minEnd = new Date(new Date(info.event.start).getTime() + minDurationMs);
        const eventEnd = durationSeconds < 30 * 60 ? minEnd : actualEnd;
        if (durationSeconds < 30 * 60) {
          info.el.style.minHeight = `${slotHeight}px`;
        }
        info.el.style.backgroundColor = "transparent";
        info.el.style.border = "none";
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
  if (!taskToDelete || !taskToDelete._id) return;
  try {
    const response = await fetch(`/api/completed-tasks/${encodeURIComponent(taskToDelete._id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to delete task');
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
    socket.emit('completedTasksUpdated', completedTasks);
  } catch (err) {
    console.error('Error deleting task:', err);
    alert('Failed to delete task. Please try again.');
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

// Add subtask and task (unchanged)
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
    closePopup(document.querySelector('.popup .popup-content button:nth-child(3)'));
    toggleSubtasks(taskIndex, true);
    socket.emit('tasksUpdated', tasks);
  }
}

function showAddTaskPopup() {
  if (document.querySelector('.popup')) closePopup(document.querySelector('.popup .popup-content button:nth-child(3)'));
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
    const newTask = {
      name: taskName,
      subtasks: [],
      prob: 1,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`
    };
    tasks.splice(tasks.length - 1, 0, newTask);
    await saveTasks(tasks);
    renderTasks();
    closePopup(document.querySelector('.popup .popup-content button:nth-child(3)'));
    socket.emit('tasksUpdated', tasks);
  }
}

function closePopup(button) {
  const popup = button.closest('.popup');
  if (popup) popup.remove();
}

// Render task list
function renderTasks() {
  const taskList = document.getElementById("task-list");
  if (!taskList) return;
  taskList.innerHTML = "";
  tasks.forEach((task, index) => {
    if (index < tasks.length - 1) {
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
          <span></span>
          <button class="add-subtask" onclick="addSubtask(${index})">+</button>
        </div>
      `;
      ul.appendChild(addLi);
      li.appendChild(ul);
      taskList.appendChild(li);
    }
  });
  const addTaskLi = document.createElement("li");
  addTaskLi.innerHTML = `
    <div class="task-header">
      <span></span>
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

// Update UI based on server state
function updateUI(data) {
  timer = data.timer;
  isPaused = data.isPaused;
  currentTask = data.currentTask;
  document.getElementById("timer").textContent = formatTime(timer);
  document.getElementById("pause-btn").textContent = isPaused ? "Resume" : "Pause";
  document.getElementById("pause-btn").disabled = !currentTask;
  document.getElementById("finish-btn").disabled = !currentTask || isPaused;
  document.getElementById("start-btn").disabled = !!currentTask;
  document.getElementById("task-text").innerHTML = currentTask
    ? `${currentTask.task}${currentTask.subtask ? " - " + currentTask.subtask : ""} (${currentTask.time / 60} hours)`
    : "Select a Task to Begin";
  document.getElementById("suggestion").style.setProperty('--task-color', currentTask ? currentTask.color : '#888888');
}

// Event listeners
document.getElementById("task-btn").addEventListener("click", generateTask);
document.getElementById("start-btn").addEventListener("click", startTimer);
document.getElementById("pause-btn").addEventListener("click", pauseTimer);
document.getElementById("finish-btn").addEventListener("click", finishTimer);
document.getElementById("time-up").addEventListener("click", () => adjustTime("up"));
document.getElementById("time-down").addEventListener("click", () => adjustTime("down"));

// Socket.IO listeners
socket.on('stateSync', updateUI);
socket.on('timerStarted', updateUI);
socket.on('timerPaused', updateUI);
socket.on('timerFinished', (data) => {
  updateUI(data);
  document.getElementById("comment-section").style.display = "flex";
});
socket.on('timerReset', (data) => {
  updateUI(data);
  document.getElementById("comment-section").style.display = "none";
  document.getElementById("task-comment").value = "";
});
socket.on('timerUpdate', updateUI);
socket.on('tasksUpdated', (data) => {
  tasks = data;
  renderTasks();
});
socket.on('completedTasksUpdated', (data) => {
  completedTasks = data; // Replace local array with server's authoritative data
  const currentView = calendar ? calendar.view.type : 'timeGridDay';
  const currentDate = calendar ? calendar.view.activeStart : new Date();
  const scrollTop = calendar ? document.getElementById("calendar").scrollTop : 0;
  if (calendar) {
    calendar.destroy();
    renderCalendar();
    calendar.changeView(currentView, currentDate);
    document.getElementById("calendar").scrollTop = scrollTop;
  }
  updateProgressBox(currentView);
});
socket.on('taskGenerated', (task) => {
  currentTask = task;
  document.getElementById("task-text").innerHTML = `${task.task}${task.subtask ? " - " + task.subtask : ""} (${task.time / 60} hours)`;
  document.getElementById("suggestion").style.setProperty('--task-color', task.color);
  document.getElementById("start-btn").disabled = false;
  document.getElementById("time-up").disabled = false;
  document.getElementById("time-down").disabled = false;
});
socket.on('taskSelected', (task) => {
  currentTask = task;
  document.getElementById("task-text").innerHTML = `${task.task}${task.subtask ? " - " + task.subtask : ""} (${task.time / 60} hours)`;
  document.getElementById("suggestion").style.setProperty('--task-color', task.color);
  document.getElementById("start-btn").disabled = false;
  document.getElementById("time-up").disabled = false;
  document.getElementById("time-down").disabled = false;
});
socket.on('taskAdjusted', (task) => {
  currentTask = task;
  document.getElementById("task-text").innerHTML = `${task.task}${task.subtask ? " - " + task.subtask : ""} (${task.time / 60} hours)`;
});

// Initial setup
Promise.all([fetchTasks(), fetchCompletedTasks()]).then(([taskData, completedData]) => {
  tasks = taskData.length ? taskData : tasks;
  completedTasks = completedData.length ? completedData : [];
  renderTasks();
  renderCalendar();
}).catch(err => {
  console.error('Initial fetch failed:', err);
  renderTasks();
  renderCalendar();
  setTimeout(() => {
    fetchTasks().then(data => {
      tasks = data.length ? data : tasks;
      renderTasks();
      socket.emit('tasksUpdated', tasks);
    });
    fetchCompletedTasks().then(data => {
      completedTasks = data.length ? data : [];
      renderCalendar();
      updateProgressBox('timeGridDay');
      socket.emit('completedTasksUpdated', completedTasks);
    });
  }, 5000);
});

// Mobile Swipe Logic (unch unchanged)
function initializeMobileSwipe() {
    if (!('ontouchstart' in window)) return; // Exit if not a touch device
    const mainContentArea = document.querySelector('.main-content');
    const body = document.body;
    if (!mainContentArea) {
      console.error("Main content area not found for swipe initialization");
      return;
    }
  
    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;
  
    function handleSwipe() {
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const swipeThreshold = 50;
  
      // Only process if swipe is primarily horizontal
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > swipeThreshold) {
        if (deltaX < -swipeThreshold) { // Swipe left
          if (body.classList.contains('show-sidebar')) {
            body.classList.remove('show-sidebar');
          } else if (!body.classList.contains('show-calendar')) {
            body.classList.add('show-calendar');
            setTimeout(() => calendar && calendar.updateSize(), 350);
          }
        } else if (deltaX > swipeThreshold) { // Swipe right
          if (body.classList.contains('show-calendar')) {
            body.classList.remove('show-calendar');
          } else if (!body.classList.contains('show-sidebar')) {
            body.classList.add('show-sidebar');
          }
        }
      }
    }
  
    function handleTap() {
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const tapThreshold = 20;
  
      if (Math.abs(deltaX) < tapThreshold && Math.abs(deltaY) < tapThreshold) {
        const sidebar = document.querySelector('.sidebar');
        const calendarEl = document.getElementById('calendar');
        const commentSection = document.getElementById('comment-section');
        const target = event.target;
  
        if (body.classList.contains('show-sidebar') || body.classList.contains('show-calendar')) {
          const isOutsideSidebar = !sidebar.contains(target);
          const isOutsideCalendar = !calendarEl.contains(target);
          const isOutsideComment = !commentSection || !commentSection.contains(target);
  
          if (isOutsideSidebar && isOutsideCalendar && isOutsideComment) {
            body.classList.remove('show-sidebar');
            body.classList.remove('show-calendar');
          }
        }
      }
    }
  
    mainContentArea.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].screenX;
      touchStartY = e.touches[0].screenY;
    }, { passive: true });
  
    mainContentArea.addEventListener('touchmove', (e) => {
      touchEndX = e.touches[0].screenX;
      touchEndY = e.touches[0].screenY;
    }, { passive: true });
  
    mainContentArea.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      handleSwipe();
      handleTap();
    }, { passive: true });
  
    // Reset sidebar/calendar on resize to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        body.classList.remove('show-sidebar');
        body.classList.remove('show-calendar');
      }
    });
  }
  
  // Run on DOM load
  document.addEventListener('DOMContentLoaded', () => {
    initializeMobileSwipe(); // No delay needed, DOM is ready
  });