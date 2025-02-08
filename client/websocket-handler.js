class WebSocketHandler {
    constructor() {
      // Determine WebSocket protocol based on the current page protocol
        const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.chatHandler = null;  // Initialize as null
        // Specify the correct WebSocket server URL
        const wsPort = 4000; // Ensure this matches your signaling server port
        const wsURL = `${wsProtocol}//${location.hostname}:${wsPort}`;

        // Establish WebSocket connection
        this.ws = new WebSocket(wsURL);
        console.log('WebSocket initialized:', this.ws);
        
        // Callback handlers
        this.onOffer = null;
        this.onAnswer = null;
        this.onIceCandidate = null;
        this.onStartCall = null;
        
        // Message queue for messages sent before connection is established
        this.messageQueue = [];
        
        this.setupWebSocketHandlers();
    }
    setChatHandler(chatHandler) {
        this.chatHandler = chatHandler;
        console.log('✅ chatHandler set successfully!');
    }

    setupWebSocketHandlers() {
        this.ws.onopen = () => {
            console.log('Connected to signaling server');
            // Send any queued messages
            while (this.messageQueue.length > 0) {
                this.ws.send(this.messageQueue.shift());
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };

        this.ws.onclose = () => {
            console.log('Disconnected from signaling server');
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Received message:', data);

            switch(data.type) {
                case 'start-call':
                    if (this.onStartCall) {
                        this.onStartCall(data.roomId);
                    }
                    break;
                    
                case 'offer':
                    if (this.onOffer) {
                        this.onOffer(data.offer);
                    }
                    break;
                    
                case 'answer':
                    if (this.onAnswer) {
                        this.onAnswer(data.answer);
                    }
                    break;
                    
                case 'ice-candidate':
                    if (this.onIceCandidate) {
                        this.onIceCandidate(data.candidate);
                    }
                    break;
                    
                case 'chat-message':
                    console.log('💬 Chat message received from server:', data.message);
                    if (this.chatHandler) {
                        this.chatHandler.displayChatMessage(data.message, "remote");
                    } else {
                        console.warn('⚠️ chatHandler is not set!');
                    }
                    break;
    
                case 'file-message':
                    console.log('📎 File message received from server:', data.fileData);
                    if (this.chatHandler) {
                        this.chatHandler.displayFileMessage(data.fileData, "remote");
                    } else {
                        console.warn('⚠️ chatHandler is not set!');
                    }
                    break;
                    
                default:
                    console.log('Unhandled message type:', data.type);
            }
        };
        
    }

    sendMessage(message) {
        const messageString = JSON.stringify(message);
        
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(messageString);
            console.log('Sent message:', message);
        } else {
            console.log('Connection not ready, queueing message:', message);
            this.messageQueue.push(messageString);
        }
    }

    sendOffer(roomId, offer) {
        this.sendMessage({
            type: 'offer',
            roomId,
            offer
        });
    }

    sendAnswer(roomId, answer) {
        this.sendMessage({
            type: 'answer',
            roomId,
            answer
        });
    }

    sendIceCandidate(roomId, candidate) {
        this.sendMessage({
            type: 'ice-candidate',
            roomId,
            candidate
        });
    }

    joinRoom(roomId) {
        this.sendMessage({
            type: 'join-room',
            roomId
        });
    }

    sendChatMessage(roomId, message) {
        this.sendMessage({
            type: 'chat-message',
            roomId,
            message
        });
    }

    sendFileMessage(roomId, fileData) {
        this.sendMessage({
            type: 'file-message',
            roomId,
            fileData
        });
    }

    
    
    
    cleanup() {
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.close();
            this.ws = null;
        }
        // Clear the message queue
        this.messageQueue = [];
        // Clear callbacks
        this.onOffer = null;
        this.onAnswer = null;
        this.onIceCandidate = null;
        this.onStartCall = null;
    }
}

export default WebSocketHandler;