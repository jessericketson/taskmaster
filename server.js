const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const { Server } = require('socket.io');
const http = require('http');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

require('dotenv').config();
const uri = process.env.MONGODB_URI || 'mongodb+srv://taskmasteruser:Taskmaster2025!@cluster0.akz0v.mongodb.net/taskmasterdb?retryWrites=true&w=majority&appName=Cluster0';
let db;

async function connectToMongo() {
  const client = new MongoClient(uri, {
    tls: true,
    minTLSVersion: 'TLSv1.2',
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 15000,
    retryWrites: true,
    retryReads: true,
    maxPoolSize: 10,
    loggerLevel: 'debug',
  });
  try {
    console.log('Attempting MongoDB connection with URI:', uri.replace(/:([^@]+)@/, ':****@'));
    await client.connect();
    db = client.db('taskmasterdb');
    console.log('Connected to MongoDB successfully');
    // Seed default tasks if empty (optional)
    const taskCount = await db.collection('tasks').countDocuments();
    if (taskCount === 0) {
      const defaultTasks = [
        { name: "Exercise", subtasks: ["Swimming", "Running"], prob: 1, color: "#ff6b6b" },
      ];
      await db.collection('tasks').insertMany(defaultTasks);
      console.log('Seeded default tasks');
    }
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    console.error('Full error:', err);
    setTimeout(connectToMongo, 5000);
  }
}

connectToMongo();

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Tasks endpoints (unchanged)
app.get('/api/tasks', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not connected, retrying...' });
    const tasks = await db.collection('tasks').find().toArray();
    console.log('GET /api/tasks returning:', tasks);
    res.json(tasks);
  } catch (err) {
    console.error('GET /api/tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not connected, retrying...' });
    const tasks = req.body;
    console.log('POST /api/tasks received:', tasks);
    await db.collection('tasks').deleteMany({});
    await db.collection('tasks').insertMany(tasks);
    console.log('Tasks saved to DB');
    io.emit('tasksUpdated', tasks);
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/tasks error:', err);
    res.status(500).json({ error: 'Failed to save tasks' });
  }
});

// New Completed Tasks endpoints
app.get('/api/completed-tasks', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not connected, retrying...' });
    const completedTasks = await db.collection('completed_tasks').find().toArray();
    console.log('GET /api/completed-tasks returning:', completedTasks);
    res.json(completedTasks);
  } catch (err) {
    console.error('GET /api/completed-tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch completed tasks' });
  }
});

app.post('/api/completed-tasks', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not connected, retrying...' });
    const completedTask = req.body;
    console.log('POST /api/completed-tasks received:', completedTask);
    await db.collection('completed_tasks').insertOne(completedTask);
    console.log('Completed task saved to DB');
    io.emit('completedTasksUpdated', await db.collection('completed_tasks').find().toArray());
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/completed-tasks error:', err);
    res.status(500).json({ error: 'Failed to save completed task' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'taskmaster.html'));
});

io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('timerUpdate', (data) => {
    socket.broadcast.emit('timerUpdate', data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});