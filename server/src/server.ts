import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSocket } from './socket';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for now, lock down in prod
        methods: ["GET", "POST"]
    }
});

// Setup Socket.io logic
setupSocket(io);

const PORT = process.env.PORT || 3001;

app.get('/health', (req, res) => {
    res.send({ status: 'ok', uptime: process.uptime() });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
