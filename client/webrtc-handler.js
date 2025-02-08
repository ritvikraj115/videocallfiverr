import CONFIG from './config.js';

class WebRTCHandler {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.ws = null;
        this.roomId = null;
        this.isInitiator = false;
        this.events = new EventTarget();
        
    }

    on(event, callback) {
        this.events.addEventListener(event, (e) => callback(e.detail));
    }

    emit(event, data) {
        this.events.dispatchEvent(new CustomEvent(event, { detail: data }));
    }

    async initialize(roomId) {
        try {
            this.roomId = roomId;
            await this._setupLocalMedia();
            await this._setupWebSocket();
            this.emit('initialized', { roomId });
        } catch (error) {
            this._handleError('initialization', error);
            throw error;
        }
    }

    async _setupLocalMedia() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia(
                CONFIG.webrtc.mediaConstraints
            );
            
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
            }
            
            this.emit('localStreamReady', { stream: this.localStream });
        } catch (error) {
            this._handleError('media', error);
            throw error;
        }
    }

    async _setupWebSocket() {
        try {
            this.ws = new WebSocket(CONFIG.websocket.url);
            
            this.ws.onopen = () => {
                this._sendSignalingMessage({
                    type: 'join-room',
                    roomId: this.roomId
                });
            };

            this.ws.onmessage = async (event) => {
                const message = JSON.parse(event.data);
                
                switch (message.type) {
                    case 'start-call':
                        this.isInitiator = true;
                        await this._initiateCall();
                        break;
                        
                    case 'offer':
                        await this._handleOffer(message.offer);
                        break;
                        
                    case 'answer':
                        await this._handleAnswer(message.answer);
                        break;
                        
                    case 'ice-candidate':
                        await this._handleNewICECandidate(message.candidate);
                        break;
                        
                    case 'peer-left':
                        this._cleanupPeerConnection();
                        break;
                }
            };

            this.ws.onerror = (error) => {
                this._handleError('websocket', error);
            };
        } catch (error) {
            this._handleError('websocket_setup', error);
            throw error;
        }
    }

    async _initiateCall() {
        await this._createPeerConnection();
        await this._createAndSendOffer();
    }

    async _createPeerConnection() {
        // Clean up any existing connection
        this._cleanupPeerConnection();

        // Create new connection
        this.peerConnection = new RTCPeerConnection({
            iceServers: CONFIG.webrtc.iceServers,
            sdpSemantics: 'unified-plan',
            bundlePolicy: 'max-bundle'
        });

        // Set up event handlers
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this._sendSignalingMessage({
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };

        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo) {
                remoteVideo.srcObject = this.remoteStream;
            }
            this.emit('remoteStreamConnected', { stream: this.remoteStream });
        };

        // Add local tracks
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });
    }

    async _createAndSendOffer() {
        try {
            if (!this.peerConnection) {
                await this._createPeerConnection();
            }

            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });

            await this.peerConnection.setLocalDescription(offer);
            
            this._sendSignalingMessage({
                type: 'offer',
                offer: offer
            });
        } catch (error) {
            this._handleError('offer', error);
        }
    }

    async _handleOffer(offer) {
        try {
            await this._createPeerConnection();
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this._sendSignalingMessage({
                type: 'answer',
                answer: answer
            });
        } catch (error) {
            this._handleError('offer_handling', error);
        }
    }

    async _handleAnswer(answer) {
        try {
            if (this.peerConnection) {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            }
        } catch (error) {
            this._handleError('answer_handling', error);
        }
    }

    async _handleNewICECandidate(candidate) {
        try {
            if (this.peerConnection) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (error) {
            this._handleError('ice_candidate', error);
        }
    }

    _cleanupPeerConnection() {
        try {
            // First remove all event listeners to prevent any callbacks
            if (this.peerConnection) {
                this.peerConnection.onicecandidate = null;
                this.peerConnection.ontrack = null;
                this.peerConnection.onnegotiationneeded = null;
                this.peerConnection.oniceconnectionstatechange = null;
                this.peerConnection.onconnectionstatechange = null;
                this.peerConnection.onicegatheringstatechange = null;
                this.peerConnection.onsignalingstatechange = null;

                // Get all senders and remove tracks
                const senders = this.peerConnection.getSenders();
                senders.forEach(sender => {
                    if (sender.track) {
                        sender.track.stop();
                        this.peerConnection.removeTrack(sender);
                    }
                });

                // Close and nullify the connection
                this.peerConnection.close();
                this.peerConnection = null;
            }

            // Clear remote stream
            if (this.remoteStream) {
                this.remoteStream.getTracks().forEach(track => {
                    track.stop();
                    track.enabled = false;
                });
                this.remoteStream = null;
            }

            // Clear the remote video element
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo) {
                remoteVideo.srcObject = null;
            }

            // Reset all state flags
            this.isInitiator = false;

            this.emit('peerLeft');
            
            // Delay before allowing new connection
            return new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error('Error during cleanup:', error);
            this._handleError('cleanup', error);
        }
    }

    // Add health check method
    async healthCheck() {
        const status = {
            local: {
                stream: !!this.localStream,
                tracks: this.localStream ? {
                    audio: this.localStream.getAudioTracks().map(t => ({
                        enabled: t.enabled,
                        muted: t.muted,
                        readyState: t.readyState
                    })),
                    video: this.localStream.getVideoTracks().map(t => ({
                        enabled: t.enabled,
                        muted: t.muted,
                        readyState: t.readyState
                    }))
                } : null
            },
            remote: {
                stream: !!this.remoteStream,
                tracks: this.remoteStream ? {
                    audio: this.remoteStream.getAudioTracks().map(t => ({
                        enabled: t.enabled,
                        muted: t.muted,
                        readyState: t.readyState
                    })),
                    video: this.remoteStream.getVideoTracks().map(t => ({
                        enabled: t.enabled,
                        muted: t.muted,
                        readyState: t.readyState
                    }))
                } : null
            },
            connection: {
                exists: !!this.peerConnection,
                connectionState: this.peerConnection?.connectionState,
                iceConnectionState: this.peerConnection?.iceConnectionState,
                signalingState: this.peerConnection?.signalingState,
                iceGatheringState: this.peerConnection?.iceGatheringState
            },
            websocket: {
                connected: this.ws?.readyState === WebSocket.OPEN,
                state: this.ws?.readyState
            }
        };

        if (this.peerConnection) {
            try {
                const stats = await this.peerConnection.getStats();
                const statsReport = {};
                
                stats.forEach(report => {
                    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                        statsReport.currentRoundTripTime = report.currentRoundTripTime;
                        statsReport.availableOutgoingBitrate = report.availableOutgoingBitrate;
                    }
                });

                status.stats = statsReport;
            } catch (error) {
                console.warn('Could not get WebRTC stats:', error);
            }
        }

        // Determine overall health
        status.healthy = (
            status.local.stream &&
            (!this.peerConnection || 
             (this.peerConnection && 
              ['connected', 'completed'].includes(status.connection.iceConnectionState)))
        );

        return status;
    }

    async _handleSignalingMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('Received signal:', message.type);

            switch (message.type) {
                case 'peer-left':
                    console.log('Peer left - cleaning up connection');
                    await this._cleanupPeerConnection();
                    this.peerConnection = null;
                    break;

                case 'start-call':
                    console.log('Starting new call as initiator');
                    await this._cleanupPeerConnection(); // Ensure clean state
                    this.isInitiator = true;
                    await this._createPeerConnection();
                    await this._createAndSendOffer();
                    break;

                case 'offer':
                    console.log('Received offer - creating new connection');
                    await this._cleanupPeerConnection(); // Ensure clean state
                    await this._handleOffer(message.offer);
                    break;

                case 'answer':
                    if (this.peerConnection) {
                        await this._handleAnswer(message.answer);
                    }
                    break;

                case 'ice-candidate':
                    if (this.peerConnection) {
                        await this._handleNewICECandidate(message.candidate);
                    }
                    break;
            }
        } catch (error) {
            this._handleError('signaling', error);
        }
    }

    async _createPeerConnection() {
        if (this.peerConnection) {
            await this._cleanupPeerConnection();
        }

        this.peerConnection = new RTCPeerConnection({
            iceServers: CONFIG.webrtc.iceServers,
            sdpSemantics: 'unified-plan',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            iceTransportPolicy: 'all'
        });

        // Add local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        // Event handlers
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this._sendSignalingMessage({
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };

        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo) {
                remoteVideo.srcObject = this.remoteStream;
            }
            this.emit('remoteStreamConnected', { stream: this.remoteStream });
        };

        return new Promise(resolve => setTimeout(resolve, 500)); // Small delay to ensure stable state
    }

    _sendSignalingMessage(message) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                ...message,
                roomId: this.roomId
            }));
        }
    }

    _handleError(type, error) {
        console.error(`WebRTC Error (${type}):`, error);
        this.emit('error', { type, error });
    }

    async toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.emit('videoToggled', { enabled: videoTrack.enabled });
                return videoTrack.enabled;
            }
        }
        return false;
    }

    async toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.emit('audioToggled', { enabled: audioTrack.enabled });
                return audioTrack.enabled;
            }
        }
        return false;
    }

    async cleanup() {
        // Clear all event listeners
        if (this.events) {
            // Remove all event listeners
            this.events = new EventTarget();
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            this.localStream = null;
        }
        
        await this._cleanupPeerConnection();
        
        if (this.ws) {
            this.ws.onmessage = null;
            this.ws.onerror = null;
            this.ws.onopen = null;
            this.ws.close();
            this.ws = null;
        }
    
        // Clear all references
        this.roomId = null;
        this.isInitiator = false;
    }

    async switchCamera() {
        if (!this.localStream) return;
    
        // Get available video input devices (cameras)
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === "videoinput");
    
        if (videoDevices.length < 2) {
            console.warn("No alternative camera found.");
            return;
        }
    
        // Get the current active camera ID
        const currentTrack = this.localStream.getVideoTracks()[0];
        const currentDeviceId = currentTrack.getSettings().deviceId;
    
        // Find the next camera (flip between front and back)
        let newDeviceId;
        for (let i = 0; i < videoDevices.length; i++) {
            if (videoDevices[i].deviceId === currentDeviceId) {
                newDeviceId = videoDevices[(i + 1) % videoDevices.length].deviceId;
                break;
            }
        }
    
        if (!newDeviceId) return;
    
        // Stop current video track
        this.localStream.getTracks().forEach(track => track.stop());
    
        // Get new stream with the selected camera
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: newDeviceId } },
            audio: true
        });
        // Replace the current stream with the new one
        this.localStream = newStream;
        localVideo.srcObject= this.localStream;
    }
}

export default WebRTCHandler;