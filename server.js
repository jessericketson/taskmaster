const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const { Server } = require('socket.io');
const http = require('http');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const uri = process.env.MONGODB_URI;
let db;

async function connectToMongo() {
  const client = new MongoClient(uri, {
    tls: true, // Explicitly enable TLS
    tlsAllowInvalidCertificates: false, // Enforce valid certs
    serverSelectionTimeoutMS: 5000, // Faster timeout for debugging
  });
  try {
    await client.connect();
    db = client.db('taskmasterdb');
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

connectToMongo();

app.use(express.static(path.join(__dirname)));
app.use(express.json());

app.get('/api/tasks', async (req, res) => {
  try {
    if (!db) throw new Error('Database not connected');
    const tasks = await db.collection('tasks').find().toArray();
    res.json(tasks);
  } catch (err) {
    console.error('GET /api/tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    if (!db) throw new Error('Database not connected');
    const tasks = req.body;
    await db.collection('tasks').deleteMany({});
    await db.collection('tasks').insertMany(tasks);
    io.emit('tasksUpdated', tasks);
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/tasks error:', err);
    res.status(500).json({ error: 'Failed to save tasks' });
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