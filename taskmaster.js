// Initial tasks array (used only if DB is empty or fails)
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
        console.error('Fetch response not OK:', response.status, response.statusText);
        throw new Error('Failed to fetch tasks');
      }
      const data = await response.json();
      console.log('Fetched tasks:', data); // Debug
      return data;
    } catch (err) {
      console.error('Error fetching tasks:', err);
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
    return true;
  } catch (err) {
    console.error('Error saving tasks:', err);
    return false;
  }
}

// Random task generator with robust subtask handling
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
  document.getElementById("accept-btn").disabled = false;
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
  document.getElementById("accept-btn").disabled = false;
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
    }
  }, 1000);
  document.getElementById("pause-btn").disabled = false;
  document.getElementById("finish-btn").disabled = false;
  document.getElementById("accept-btn").disabled = true;
}

function pauseTimer() {
  isPaused = !isPaused;
  document.getElementById("pause-btn").textContent = isPaused ? "Resume" : "Pause";
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
  completedTasks.push(currentTask);
  tasks.find(t => t.name === currentTask.task).prob = Math.max(0.1, tasks.find(t => t.name === currentTask.task).prob * 0.8);
  await saveTasks(tasks); // Save updated tasks to DB
  resetTimer();
  document.getElementById("comment-section").style.display = "none";
  document.getElementById("task-comment").value = "";
  const currentView = calendar.view.type;
  const currentDate = calendar.view.activeStart;
  calendar.destroy();
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
  document.getElementById("accept-btn").disabled = true;
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

// Calendar rendering with task details below
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
      maxSeconds = 8 * 3600; // 8 hours
      title = "Daily Progress";
      break;
    case "timeGridWeek":
      startDate = new Date(now.setDate(now.getDate() - now.getDay()));
      maxSeconds = 56 * 3600; // 56 hours
      title = "Weekly Progress";
      break;
    case "dayGridMonth":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      maxSeconds = 224 * 3600; // 224 hours
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

  const pixelsPerSecond = 1200 / maxSeconds; // Scale to 1200px
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

// Weekly report with comments and progress
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

// Add new task
async function addTask() {
  const input = document.getElementById("new-task");
  const taskName = input.value.trim().split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
  if (taskName) {
    tasks.push({
      name: taskName,
      subtasks: [],
      prob: 1,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`
    });
    input.value = "";
    await saveTasks(tasks);
    renderTasks();
  }
}

// Remove task
async function deleteTask(index) {
  tasks.splice(index, 1);
  await saveTasks(tasks);
  renderTasks();
  updateProgressBox(calendar.view.type);
}

// Add subtask dynamically
async function addSubtask(index) {
  const subtaskName = prompt("Enter subtask name:");
  if (subtaskName) {
    const formattedName = subtaskName.split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
    tasks[index].subtasks.push(formattedName);
    await saveTasks(tasks);
    renderTasks();
  }
}

// Remove subtask
async function deleteSubtask(taskIndex, subtaskName) {
  tasks[taskIndex].subtasks = tasks[taskIndex].subtasks.filter(sub => (typeof sub === "string" ? sub : sub.name) !== subtaskName);
  await saveTasks(tasks);
  renderTasks();
}

// Render task list with collapsible subtasks and color bands
function renderTasks() {
  const taskList = document.getElementById("task-list");
  taskList.innerHTML = "";
  tasks.forEach((task, index) => {
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
      const subLi = document.createElement("li");
      const subName = typeof sub === "string" ? sub : sub.name;
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
    addLi.innerHTML = `<button class="add-subtask" onclick="addSubtask(${index})">+</button>`;
    ul.appendChild(addLi);
    li.appendChild(ul);
    taskList.appendChild(li);
  });
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

// Sync state from localStorage on load (temporary, until fully transitioned)
function loadState() {
  // No longer needed with MongoDB, but kept for fallback
  const savedTask = localStorage.getItem("currentTask");
  if (savedTask) {
    currentTask = JSON.parse(savedTask);
    timer = parseInt(localStorage.getItem("timer")) || 0;
    isPaused = localStorage.getItem("isPaused") === "true";
    document.getElementById("task-text").innerHTML = `${currentTask.task}${currentTask.subtask ? " - " + currentTask.subtask : ""} (${currentTask.time / 60} hours)`;
    document.getElementById("suggestion").style.setProperty('--task-color', currentTask.color);
    document.getElementById("timer").textContent = formatTime(timer);
    document.getElementById("accept-btn").disabled = true;
    document.getElementById("pause-btn").disabled = false;
    document.getElementById("finish-btn").disabled = false;
    document.getElementById("pause-btn").textContent = isPaused ? "Resume" : "Pause";
    if (!isPaused) {
      interval = setInterval(() => {
        if (!isPaused) {
          timer++;
          document.getElementById("timer").textContent = formatTime(timer);
        }
      }, 1000);
    }
  }
}

// Event listeners
document.getElementById("task-btn").addEventListener("click", () => generateTask());
document.getElementById("accept-btn").addEventListener("click", startTimer);
document.getElementById("pause-btn").addEventListener("click", pauseTimer);
document.getElementById("finish-btn").addEventListener("click", finishTimer);
document.getElementById("time-up").addEventListener("click", () => adjustTime("up"));
document.getElementById("time-down").addEventListener("click", () => adjustTime("down"));

// Initial setup with MongoDB
fetchTasks().then(data => {
    console.log('Initial tasks from DB:', data);
    tasks = data.length ? data : tasks; // Use DB data or default
    completedTasks = [];
    renderTasks();
    renderCalendar();
    loadState();
  }).catch(err => {
    console.error('Initial fetch failed:', err);
    renderTasks(); // Render default anyway
    renderCalendar();
    loadState();
    setTimeout(() => fetchTasks().then(data => {
      console.log('Retry tasks:', data);
      tasks = data.length ? data : tasks;
      renderTasks();
    }), 5000);
  });
  
setInterval(() => {
  if (new Date().getDay() === 1 && new Date().getHours() === 8) generateWeeklyReport();
}, 3600000);