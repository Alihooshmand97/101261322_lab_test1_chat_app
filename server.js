require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const User = require('./models/User');
const Message = require('./models/Message');
const userRoutes = require('./routes/userRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public', 'view')));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

// Routes
app.use('/api/users', userRoutes);
app.get('/', (req, res) => {
    res.send('Chat server is running...');
});

// Serve Pages
app.get('/signup.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/chat.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// User Management
let roomUsers = {};

io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle user joining a room
    socket.on('joinRoom', async ({ username, room }) => {
        socket.join(room);
        if (!roomUsers[room]) roomUsers[room] = [];
        if (!roomUsers[room].includes(username)) {
            roomUsers[room].push(username);
        }

        io.to(room).emit('roomUsers', roomUsers[room]);
        
        try {
            const messages = await Message.find({ room }).sort({ date_sent: 1 }).limit(20);
            socket.emit('previousMessages', messages);
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    });

    // Handle sending messages
    socket.on('chatMessage', async ({ from_user, room, message }) => {
        if (!from_user || !room || !message) {
            console.error("Missing data:", { from_user, room, message });
            return;
        }
    
        try {
            const newMessage = new Message({ from_user, room, message });
            await newMessage.save();
            console.log('Message saved:', newMessage);
            io.to(room).emit('message', newMessage);
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    // Handle private messages
    io.on('connection', (socket) => {
        console.log('A user connected');
    
        // Handle private messages
        socket.on('privateMessage', async ({ from_user, to_user, message }) => {
            if (!from_user || !to_user || !message) {
                console.error("Private message missing fields:", { from_user, to_user, message });
                return;
            }
    
            try {
                const newMessage = new Message({ from_user, to_user, message });
                await newMessage.save();
    
                // Send private message to recipient
                io.to(to_user).emit('privateMessage', { from_user, message });
    
                console.log(`Private message sent from ${from_user} to ${to_user}: ${message}`);
            } catch (error) {
                console.error('Error sending private message:', error);
            }
        });
    });

    // Handle typing indicator
    socket.on('typing', ({ username, room }) => {
        socket.to(room).emit('userTyping', { username });
    });

    socket.on('stopTyping', ({ room }) => {
        socket.to(room).emit('userStoppedTyping');
    });

    // Handle leaving room
    socket.on('leaveRoom', ({ username, room }) => {
        socket.leave(room);
        roomUsers[room] = roomUsers[room].filter(user => user !== username);
        io.to(room).emit('roomUsers', roomUsers[room]);
        io.to(room).emit('message', { username: 'System', message: `${username} has left the chat`, date_sent: new Date() });
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Server Port
const PORT = process.env.PORT || 5500;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
