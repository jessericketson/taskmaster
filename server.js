const express = require('express');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb'); // Import ObjectId
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
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 15000,
        retryWrites: true,
        retryReads: true,
        maxPoolSize: 10,
    });
    try {
        console.log('Attempting MongoDB connection...');
        await client.connect();
        db = client.db('taskmasterdb');
        console.log('Connected to MongoDB successfully');
    } catch (err) {
        console.error('MongoDB connection failed:', err);
        setTimeout(connectToMongo, 5000); // Retry
    }
}

connectToMongo();

app.use(express.static(path.join(__dirname)));
app.use(express.json());

app.get('/api/tasks', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database not connected' });
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
        if (!db) return res.status(503).json({ error: 'Database not connected' });
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

app.get('/api/completed-tasks', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database not connected' });
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
        if (!db) return res.status(503).json({ error: 'Database not connected' });
        const completedTask = req.body;
        console.log('POST /api/completed-tasks received:', completedTask);
        const result = await db.collection('completed_tasks').insertOne(completedTask);
        console.log('Completed task saved to DB with _id:', result.insertedId);
        const updatedCompletedTasks = await db.collection('completed_tasks').find().toArray();
        io.emit('completedTasksUpdated', updatedCompletedTasks);
        res.json({ success: true, insertedId: result.insertedId });
    } catch (err) {
        console.error('POST /api/completed-tasks error:', err);
        res.status(500).json({ error: 'Failed to save completed task' });
    }
});

app.delete('/api/completed-tasks/:id', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database not connected' });
        const taskId = req.params.id;
        console.log(`DELETE /api/completed-tasks/${taskId} received`);
        // Convert the string ID to an ObjectId
        let objectId;
        try {
            objectId = new ObjectId(taskId);
        } catch (err) {
            console.warn(`Invalid ObjectId format for ID ${taskId}`);
            return res.status(400).json({ error: 'Invalid task ID format' });
        }
        const result = await db.collection('completed_tasks').deleteOne({ _id: objectId });
        if (result.deletedCount === 0) {
            console.warn(`No task found with ID ${taskId} to delete`);
            return res.status(404).json({ error: 'Task not found' });
        }
        console.log(`Task with ID ${taskId} deleted from DB`);
        const updatedCompletedTasks = await db.collection('completed_tasks').find().toArray();
        io.emit('completedTasksUpdated', updatedCompletedTasks);
        res.json({ success: true });
    } catch (err) {
        console.error(`DELETE /api/completed-tasks/${req.params.id} error:`, err);
        res.status(500).json({ error: 'Failed to delete completed task' });
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