const CONFIG = {
    // WebSocket configuration
    websocket: {
        // Automatically determine WebSocket URL based on current protocol/host
        url: window.location.protocol === 'https:' 
            ? `wss://${window.location.hostname}:4000` 
            : `ws://${window.location.hostname}:4000`,
        reconnectAttempts: 3,
        reconnectDelay: 2000, // 2 seconds
        heartbeatInterval: 30000 // 30 seconds
    },
    // WebRTC configuration
    webrtc: {
        // ICE Servers configuration
        iceServers: [
            {
                urls: [
                    'stun:stun1.l.google.com:19302',
                    'stun:stun2.l.google.com:19302'
                ]
            }
        ],

        // Media constraints for getUserMedia
        mediaConstraints: {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
                facingMode: 'user'
            }
        },

        // RTCPeerConnection configuration
        peerConnectionConfig: {
            iceTransportPolicy: 'all',
            bundlePolicy: 'balanced',
            rtcpMuxPolicy: 'require',
            iceCandidatePoolSize: 0
        }
    },

    // Timeout values (in milliseconds)
    timeouts: {
        // Time to wait for peer connection establishment
        connectionTimeout: 30000,
        // Time to wait for media devices
        mediaTimeout: 10000,
        // Time to wait for remote stream
        streamTimeout: 15000,
        // ICE gathering timeout
        iceGatheringTimeout: 5000
    },

    // Debug settings
    debug: {
        // Enable detailed logging
        enabled: false,
        // Enable WebRTC stats collection
        enableStats: false,
        // Stats collection interval
        statsInterval: 1000,
        // Log levels: 'error', 'warn', 'info', 'debug'
        logLevel: 'warn'
    }
};

// Detect mobile device
CONFIG.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Adjust video quality for mobile devices
if (CONFIG.isMobile) {
    CONFIG.webrtc.mediaConstraints.video = {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 24 },
        facingMode: 'user'
    };
}

// Prevent modifications to the configuration
Object.freeze(CONFIG);

export default CONFIG;