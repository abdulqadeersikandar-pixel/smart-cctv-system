import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app); 

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST']
}));
app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'active', message: 'Smart CCTV Cloud Server is running!' });
});

// WebRTC Signaling Hub
io.on('connection', (socket) => {
    console.log(`🟢 Node Connected: ${socket.id}`);

    // 1. Jab Camera 'offer' bheje, toh usay Dashboard (baki sab) ko relay kar do
    socket.on('offer', (offer) => {
        socket.broadcast.emit('offer', offer);
    });

    // 2. Jab Dashboard 'answer' bheje, toh wapas Camera ko relay kar do
    socket.on('answer', (answer) => {
        socket.broadcast.emit('answer', answer);
    });

    // 3. Connection ke network raste (ICE Candidates) exchange karna
    socket.on('ice-candidate', (candidate) => {
        socket.broadcast.emit('ice-candidate', candidate);
    });

    socket.on('disconnect', () => {
        console.log(`🔴 Node Disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`🚀 Cloud Backend is running on http://localhost:${PORT}`);
});