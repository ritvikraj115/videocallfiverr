const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const meetingRoutes = require('./routes/meetingRoutes');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.static('../client'));
app.use(bodyParser.json());
app.use('/api', meetingRoutes);

// Main route
app.get('/', (req, res) => {
    res.sendFile('index.html');
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = new Map();

// Generate 8-digit random room number
function generateRandomNumber() {
    const min = 10000000; // Smallest 8-digit number
    const max = 99999999; // Largest 8-digit number
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
  
console.log(generateRandomNumber());

function handleJoinRoom(ws, roomId) {
    const room = rooms.get(roomId) || new Set();
    room.add(ws);
    rooms.set(roomId, room);
    
    console.log(`Client joined room: ${roomId}, Total clients: ${room.size}`);

    if (room.size === 2) {
        // Notify first peer to start the call
        const [firstPeer] = room;
        firstPeer.send(JSON.stringify({
            type: 'start-call',
            roomId
        }));
        console.log('Triggered start-call for first peer');
    }
}

function broadcastToOthers(sender, roomId, message) {
    const room = rooms.get(roomId);
    if (!room) return;

    room.forEach(client => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

wss.on('connection', (ws) => {
    console.log('Client connected');
    let currentRoom = null;

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        console.log(`[${data.type}] received for room:`, data.roomId);

        switch (data.type) {
            case 'join-room':
                handleJoinRoom(ws, data.roomId);
                currentRoom = data.roomId;
                break;
                
            case 'offer':
                broadcastToOthers(ws, data.roomId, {
                    type: 'offer',
                    offer: data.offer
                });
                break;
                
            case 'answer':
                broadcastToOthers(ws, data.roomId, {
                    type: 'answer',
                    answer: data.answer
                });
                break;
                
            case 'ice-candidate':
                broadcastToOthers(ws, data.roomId, {
                    type: 'ice-candidate',
                    candidate: data.candidate
                });
                break;
        }
    });

    ws.on('close', () => {
        if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                room.delete(ws);
                if (room.size === 0) {
                    rooms.delete(currentRoom);
                } else {
                    broadcastToOthers(ws, currentRoom, { type: 'peer-left' });
                }
            }
        }
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
