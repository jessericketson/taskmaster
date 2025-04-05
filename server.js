const express = require('express');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { Server } = require('socket.io');
const http = require('http');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

require('dotenv').config();
const uri = process.env.MONGODB_URI || 'mongodb+srv://taskmasteruser:Taskmaster2025!@cluster0.akz0v.mongodb.net/taskmasterdb?retryWrites=true&w=majority&appName=Cluster0'; //
let db;
const ACTIVE_TIMER_DOC_ID = 'singleton_active_timer'; // Use a fixed ID for the single active timer state document

// Centralized state for timer - will be loaded from/synced with DB
let globalTimerState = {
  currentTask: null,
  timer: 0,
  isPaused: true,
  startTimestamp: null, // Will store as Date object in memory
  totalPausedTime: 0,
  pauseTimestamp: null // Will store as Date object in memory
};

// *** Function to load active timer state from DB on startup ***
async function loadActiveTimerState() {
  if (!db) return;
  try {
    const persistedState = await db.collection('active_timer').findOne({ _id: ACTIVE_TIMER_DOC_ID });
    if (persistedState) {
      console.log('Found persisted timer state, loading:', persistedState);
      // Restore globalTimerState, ensuring Date objects are reconstructed
      globalTimerState = {
         ...persistedState,
         startTimestamp: persistedState.startTimestamp ? new Date(persistedState.startTimestamp) : null,
         pauseTimestamp: persistedState.pauseTimestamp ? new Date(persistedState.pauseTimestamp) : null,
         // Ensure currentTask is properly structured
         currentTask: persistedState.currentTask || null,
       };
      // If the timer was running when the server stopped, recalculate elapsed time
      if (!globalTimerState.isPaused && globalTimerState.startTimestamp) {
          const now = Date.now();
          // Recalculate based on persisted start and paused time
          globalTimerState.timer = Math.floor((now - globalTimerState.startTimestamp.getTime() - globalTimerState.totalPausedTime) / 1000);
          console.log(`Resumed timer calculation. Current elapsed: ${globalTimerState.timer}s`);
      }
    } else {
      console.log('No active timer state found in DB.');
      // Ensure globalTimerState is reset if nothing found
       globalTimerState = { currentTask: null, timer: 0, isPaused: true, startTimestamp: null, totalPausedTime: 0, pauseTimestamp: null };
    }
    // Emit the loaded/reset state to any connecting clients immediately after loading
    // Note: io might not be fully ready if called directly in connectToMongo before io setup.
    // Consider emitting in io.on('connection') or after server listen.
    // For simplicity here, we rely on connection event emission.
    console.log('Initial globalTimerState set:', globalTimerState);
  } catch (err) {
    console.error('Error loading active timer state:', err);
  }
}

// *** Function to save/update active timer state in DB ***
async function saveActiveTimerState() {
    if (!db) return;
    try {
        // Make sure Date objects are stored correctly (as ISODate via toISOString)
         const stateToSave = {
            ...globalTimerState,
            // Convert Date objects to ISO strings for DB storage
            startTimestamp: globalTimerState.startTimestamp ? globalTimerState.startTimestamp.toISOString() : null,
            pauseTimestamp: globalTimerState.pauseTimestamp ? globalTimerState.pauseTimestamp.toISOString() : null,
        };
        await db.collection('active_timer').updateOne(
            { _id: ACTIVE_TIMER_DOC_ID },
            { $set: stateToSave },
            { upsert: true } // Creates the document if it doesn't exist
        );
        // console.log('Active timer state saved/updated in DB.'); // Optional: reduce logging noise
    } catch (err) {
        console.error('Error saving active timer state:', err);
    }
}

// *** Function to delete active timer state from DB ***
async function deleteActiveTimerState() {
    if (!db) return;
    try {
        await db.collection('active_timer').deleteOne({ _id: ACTIVE_TIMER_DOC_ID });
        console.log('Active timer state deleted from DB.');
    } catch (err) {
        console.error('Error deleting active timer state:', err);
    }
}


async function connectToMongo() {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000, //
    connectTimeoutMS: 15000, //
    retryWrites: true, //
    retryReads: true, //
    maxPoolSize: 10, //
  });
  try {
    console.log('Attempting MongoDB connection...');
    await client.connect();
    db = client.db('taskmasterdb'); //
    console.log('Connected to MongoDB successfully');

    // *** Load persisted state after successful connection ***
    await loadActiveTimerState();

  } catch (err) {
    console.error('MongoDB connection failed:', err.message, err.stack); //
    console.log('Retrying MongoDB connection in 5 seconds...'); // Added clarity
    setTimeout(connectToMongo, 5000); // Retry after 5 seconds //
  }
}

connectToMongo(); //

app.use(express.static(path.join(__dirname))); //
app.use(express.json()); //

// --- API Routes ---

app.get('/api/tasks', async (req, res) => { //
  try {
    if (!db) return res.status(503).json({ error: 'Database not connected' });
    const tasks = await db.collection('tasks').find().toArray();
    console.log('GET /api/tasks returning:', tasks.length, 'tasks');
    res.json(tasks);
  } catch (err) {
    console.error('GET /api/tasks error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.get('/api/completed-tasks', async (req, res) => { //
  try {
    if (!db) return res.status(503).json({ error: 'Database not connected' });
    const completedTasks = await db.collection('completed_tasks').find().toArray();
    console.log('GET /api/completed-tasks returning:', completedTasks.length, 'tasks');
    res.json(completedTasks);
  } catch (err) {
    console.error('GET /api/completed-tasks error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch completed tasks' });
  }
});

// Single definition for POST /api/completed-tasks (removed duplicate from original)
app.post('/api/completed-tasks', async (req, res) => { //
    try {
      if (!db) return res.status(503).json({ error: 'Database not connected' });
      const completedTask = req.body;
      // Add basic validation if needed
      if (!completedTask || typeof completedTask !== 'object') {
          return res.status(400).json({ error: 'Invalid task data received' });
      }
      console.log('POST /api/completed-tasks received:', completedTask);
      const result = await db.collection('completed_tasks').insertOne(completedTask); //
      console.log('Completed task saved to DB with _id:', result.insertedId);

      // *** Delete active timer state AFTER successful save ***
      await deleteActiveTimerState();

      // Fetch updated list and broadcast
      const updatedCompletedTasks = await db.collection('completed_tasks').find().toArray(); //
      io.emit('completedTasksUpdated', updatedCompletedTasks); // Broadcast to all clients //
      res.status(201).json({ success: true, insertedId: result.insertedId }); // Use 201 Created status
    } catch (err) {
      console.error('POST /api/completed-tasks error:', err.message, err.stack); //
      res.status(500).json({ error: 'Failed to save completed task' }); //
    }
});

app.delete('/api/completed-tasks/:id', async (req, res) => { //
  try {
    if (!db) return res.status(503).json({ error: 'Database not connected' });
    const taskId = req.params.id;
    console.log(`DELETE /api/completed-tasks/${taskId} received`);
    let objectId;
    try {
      objectId = new ObjectId(taskId); //
    } catch (err) {
      console.warn(`Invalid ObjectId format for ID ${taskId}`);
      return res.status(400).json({ error: 'Invalid task ID format' }); //
    }
    const result = await db.collection('completed_tasks').deleteOne({ _id: objectId }); //
    if (result.deletedCount === 0) {
      console.warn(`No task found with ID ${taskId} to delete`);
      return res.status(404).json({ error: 'Task not found' }); //
    }
    console.log(`Task with ID ${taskId} deleted from DB`);
    const updatedCompletedTasks = await db.collection('completed_tasks').find().toArray(); //
    io.emit('completedTasksUpdated', updatedCompletedTasks); // Broadcast to all clients //
    res.json({ success: true }); //
  } catch (err) {
    console.error(`DELETE /api/completed-tasks/${req.params.id} error:`, err.message, err.stack); //
    res.status(500).json({ error: 'Failed to delete completed task' }); //
  }
});

// Catch-all route for SPA
app.get('*', (req, res) => { //
  res.sendFile(path.join(__dirname, 'taskmaster.html')); //
});

// --- Server-driven timer updates ---
function updateTimer() {
  if (!globalTimerState.isPaused && globalTimerState.startTimestamp) {
    const now = Date.now();
    // Ensure startTimestamp is a valid Date object before using getTime()
    if (globalTimerState.startTimestamp instanceof Date) {
        globalTimerState.timer = Math.floor((now - globalTimerState.startTimestamp.getTime() - globalTimerState.totalPausedTime) / 1000);
        io.emit('timerUpdate', globalTimerState); //
    } else {
        // Handle case where startTimestamp might not be loaded correctly yet
        // console.warn('updateTimer skipped: startTimestamp is not a valid Date object.');
    }
  }
}

setInterval(updateTimer, 1000); // Update every second //

// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => { //
  console.log('Client connected:', socket.id); //

  // Send current state (potentially loaded from DB) to the new client
  socket.emit('stateSync', globalTimerState); //

  socket.on('startTimer', (task) => { //
    console.log('startTimer event received for task:', task);
    const now = new Date(); // Use Date object
    globalTimerState = {
      currentTask: task,
      timer: 0,
      isPaused: false,
      startTimestamp: now, // Store as Date object
      totalPausedTime: 0,
      pauseTimestamp: null,
    };
    // Ensure start time is added to the task object if needed by client
    if (globalTimerState.currentTask) {
        globalTimerState.currentTask.start = now.toISOString(); // Store ISO string // logic adapted
    }
    io.emit('timerStarted', globalTimerState); //
    // *** Save state to DB ***
    saveActiveTimerState();
  });

  socket.on('pauseTimer', () => { //
    console.log('pauseTimer event received. Current state:', globalTimerState.isPaused);
    const now = new Date(); // Use Date object
    if (!globalTimerState.currentTask || !globalTimerState.startTimestamp) { // Check state validity
        console.warn('pauseTimer ignored: No active task or start timestamp.');
        return;
    }

    if (globalTimerState.isPaused) { // Resuming
        if (globalTimerState.pauseTimestamp instanceof Date) { // Ensure pauseTimestamp is valid Date logic adapted
             globalTimerState.totalPausedTime += (now.getTime() - globalTimerState.pauseTimestamp.getTime()); // logic adapted
        } else {
            console.warn('Resuming timer, but pauseTimestamp was invalid.');
        }
        globalTimerState.isPaused = false; //
        globalTimerState.pauseTimestamp = null; //
        console.log('Timer resumed. Total paused time:', globalTimerState.totalPausedTime);
    } else { // Pausing
        globalTimerState.isPaused = true; //
        globalTimerState.pauseTimestamp = now; // Store Date object // logic adapted
        console.log('Timer paused at:', globalTimerState.pauseTimestamp);
    }
    io.emit('timerPaused', globalTimerState); //
    // *** Save state to DB ***
    saveActiveTimerState();
  });

  socket.on('finishTimer', () => { //
    console.log('finishTimer event received.');
    if (!globalTimerState.currentTask || !(globalTimerState.startTimestamp instanceof Date)) { // Check state validity
        console.warn('finishTimer ignored: No active task or invalid start timestamp.');
        return;
    }

    const now = new Date(); // Use Date object
    // Calculate final duration accurately based on whether it was running or paused
    if (!globalTimerState.isPaused) { // If it was running when finished
         globalTimerState.timer = Math.floor((now.getTime() - globalTimerState.startTimestamp.getTime() - globalTimerState.totalPausedTime) / 1000); // logic adapted
    } else if (globalTimerState.pauseTimestamp instanceof Date) { // If it was paused when finished
         // Time stopped at the last pause timestamp
         globalTimerState.timer = Math.floor((globalTimerState.pauseTimestamp.getTime() - globalTimerState.startTimestamp.getTime() - globalTimerState.totalPausedTime) / 1000); // logic adapted
    } else {
         // Fallback if paused state/timestamp is inconsistent, calculate up to 'now'
         globalTimerState.timer = Math.floor((now.getTime() - globalTimerState.startTimestamp.getTime() - globalTimerState.totalPausedTime) / 1000);
         console.warn('finishTimer executed while paused but pauseTimestamp was invalid. Calculated duration up to now.');
    }
    // Ensure timer is not negative
    globalTimerState.timer = Math.max(0, globalTimerState.timer);

    // Update task details
    globalTimerState.currentTask.end = now.toISOString(); // Store ISO string // logic adapted
    globalTimerState.currentTask.duration = globalTimerState.timer; //

    globalTimerState.isPaused = true; // Ensure timer stops updating //
    // Keep currentTask in state for client to use when saving comment

    console.log('Timer finished. Final state:', globalTimerState);
    io.emit('timerFinished', globalTimerState); //
     // State will be fully deleted upon reset or after saveComment completion
     // Save the state reflecting it's finished but not yet saved/reset
     saveActiveTimerState();
  });

  socket.on('resetTimer', () => { //
    console.log('resetTimer event received.');
    globalTimerState = { currentTask: null, timer: 0, isPaused: true, startTimestamp: null, totalPausedTime: 0, pauseTimestamp: null }; // logic adapted
    io.emit('timerReset', globalTimerState); //
    // *** Delete state from DB ***
    deleteActiveTimerState();
  });

  // --- Passthrough events (can likely be removed if not used for broadcast logic) ---
  socket.on('tasksUpdated', (tasks) => { //
    io.emit('tasksUpdated', tasks); // Broadcast to all clients //
  });

  socket.on('completedTasksUpdated', (completedTasks) => { //
    io.emit('completedTasksUpdated', completedTasks); // Broadcast to all clients //
  });

  socket.on('taskGenerated', (task) => { //
    io.emit('taskGenerated', task); //
  });

  socket.on('taskSelected', (task) => { //
    io.emit('taskSelected', task); //
  });

  socket.on('taskAdjusted', (task) => { //
    io.emit('taskAdjusted', task); //
  });
  // --- End Passthrough events ---

  socket.on('disconnect', () => { //
    console.log('Client disconnected:', socket.id); //
  });
});

// --- Start Server ---
server.listen(PORT, '0.0.0.0', () => { // logic adapted for 0.0.0.0
  console.log(`Server running on port ${PORT}`); //
});