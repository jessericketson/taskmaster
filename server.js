


const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const { Server } = require('socket.io');
const http = require('http');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3001;

require('dotenv').config();
const uri = process.env.MONGODB_URI || 'mongodb+srv://taskmasteruser:Lkp4nWrb31iQCCT2@cluster0.akz0v.mongodb.net/taskmasterdb?retryWrites=true&w=majority';
let db;

async function connectToMongo() {
  const client = new MongoClient(uri, {
    tls: true,
    tlsAllowInvalidCertificates: false, // Ensure valid certs
    tlsCAFile: undefined, // Let system handle CA (Render default)
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    retryWrites: true,
    maxPoolSize: 10,
  });

  try {
    console.log('Attempting MongoDB connection...');
    await client.connect();
    db = client.db('taskmasterdb');
    console.log('Connected to MongoDB successfully');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    console.error('Full error:', err);
    // Don’t throw; keep server running
    setTimeout(connectToMongo, 5000); // Retry after 5s
  }
}

connectToMongo();

app.use(express.static(path.join(__dirname)));
app.use(express.json());

app.get('/api/tasks', async (req, res) => {
    try {
      if (!db) {
        console.warn('Database not connected yet');
        return res.status(503).json({ error: 'Database not connected, retrying...' });
      }
      const tasks = await db.collection('tasks').find().toArray();
      console.log('GET /api/tasks returning:', tasks); // Debug
      res.json(tasks);
    } catch (err) {
      console.error('GET /api/tasks error:', err);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });
  
  app.post('/api/tasks', async (req, res) => {
    try {
      if (!db) {
        console.warn('Database not connected yet');
        return res.status(503).json({ error: 'Database not connected, retrying...' });
      }
      const tasks = req.body;
      console.log('POST /api/tasks received:', tasks); // Debug
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