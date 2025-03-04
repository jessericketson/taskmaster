const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
const uri = process.env.MONGODB_URI; // Set in Render Advanced settings
let db;

async function connectToMongo() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    db = client.db('taskmasterdb');
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

connectToMongo();

// Middleware
app.use(express.static(path.join(__dirname)));
app.use(express.json()); // Parse JSON bodies

// API Endpoints
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await db.collection('tasks').find().toArray();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const tasks = req.body;
    await db.collection('tasks').deleteMany({}); // Clear existing tasks
    await db.collection('tasks').insertMany(tasks);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save tasks' });
  }
});

// Serve HTML
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'taskmaster.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

async function connectToMongo() {
    const client = new MongoClient(uri);
    try {
      await client.connect();
      db = client.db('taskmasterdb');
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('MongoDB connection error:', err);
      throw err; // Ensure error is visible
    }
  }