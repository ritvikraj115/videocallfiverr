import WebRTCHandler from './webrtc-handler.js';
import CONFIG from './config.js';
import StartupCheck from './startup-check.js';
import CallTimer from './timer.js';
import WebSocketHandler from './websocket-handler.js';
import ChatHandler from './chatHandler.js';  // Import ChatHandler

class UIController {
    constructor() {
        // Initialize WebRTC handler
        this.webrtc = new WebRTCHandler();
        this.webSocketHandler= new WebSocketHandler();
        this.chatHandler = new ChatHandler(this.webSocketHandler, this.webrtc); // Initialize ChatHandler
         // 🔥 Set the chat handler in WebSocketHandler
         this.webSocketHandler.setChatHandler(this.chatHandler);

        // Cache DOM elements
        this.elements = {
            // Video elements
            localVideo: document.getElementById('localVideo'),
            remoteVideo: document.getElementById('remoteVideo'),
            insetVideo: document.getElementById('insetVideo'),
            mainVideo: document.querySelector('.mainVideo'),

            // Control buttons
            videoButton: document.querySelector('.videoicon'),
            micButton: document.querySelector('.mic'),
            endCallButton: document.querySelector('.endCall'),
            speakerButton: document.querySelector('.speaker'),
            flipCameraButton: document.querySelector('.flipCamera'),
            messageButton: document.querySelector('.message'),
            closeChat: document.querySelector('.closeChat'),
            expandButton: document.querySelector('.expand-icon'),
            subtitleToggle: document.getElementById('subtitleToggle'),

            // Chat section
            chatSection: document.querySelector('.chatSection'),
            videoSection: document.querySelector('.videoSection'),

            // Timer elements
            timer: document.getElementById('timer'),
            // videoControls
            videoControls: document.querySelector('.bottomWrapper'),
            hideControlsTimeout: null,

            //chat
            sendButton: document.getElementById("sendChat"),
            fileInput: document.getElementById("fileInput"),
            messageInput: document.querySelector(".chatInputWrapper input"),

        };

        // UI State
        this.state = {
            isMainVideoDragged: false,
            isInsetVideoDragged: true,
            startTouchY: 0, // To track the start position of the touch
            isVideoEnabled: true,
            isAudioEnabled: true,
            isSpeakerEnabled: true,
            isChatOpen: false,
            isVideoSwapped: false,
            isCallActive: false,
            callStartTime: null,
            captions: [
                "Hi guys, thank you so much for coming.",
                "Uhh, it's been a long time no see.",
                "Let’s discuss the project updates.",
            ],
            currentCaptionIndex: 0,
            captionInterval: null,
        };

        // Call monitoring
        this.healthCheckInterval = null;
        this.connectionMonitorInterval = null;
    }

    async initialize() {
        try {
            // Perform startup checks
            await StartupCheck.performChecks();

            // Get or generate room ID
            const urlParams = new URLSearchParams(window.location.search);
            this.roomId = urlParams.get('room') || this._generateRoomId();

            // Update URL if needed
            if (!urlParams.has('room')) {
                window.history.replaceState({}, '', `?room=${this.roomId}`);
            }

            // Initialize timer
            this.timer = new CallTimer();

            // Set up event listeners
            await this._setupEventListeners();
            await this._setupWebRTCListeners();

            // Initialize call
            await this._initializeCall();
            // captionbox
            await this.initSubtitles();

            // Start monitoring
            this._startMonitoring();

        } catch (error) {
            this._handleError('initialization', error);
            throw error;
        }
    }

    _checkBrowserSupport() {
        return !!(
            navigator.mediaDevices &&
            navigator.mediaDevices.getUserMedia &&
            window.RTCPeerConnection &&
            window.WebSocket
        );
    }

    _generateRoomId() {
        return Math.floor(10000000 + Math.random() * 90000000).toString();
    }

    _setupEventListeners() {
        // Video toggle
        this.elements.videoButton?.addEventListener('click', () => this._toggleVideo());

        // Audio toggle
        this.elements.micButton?.addEventListener('click', () => this._toggleAudio());

        // End call
        this.elements.endCallButton?.addEventListener('click', () => this._endCall());

        // Speaker toggle
        this.elements.speakerButton?.addEventListener('click', () => this._toggleSpeaker());

        // Camera flip
        this.elements.flipCameraButton?.addEventListener('click', () => this._flipCamera());

        // Chat toggle
        this.elements.messageButton?.addEventListener('click', () => this._toggleChat());

        // Chat toggle
        this.elements.closeChat?.addEventListener('click', () => this._toggleChat());

        //Chat Db store
        this.elements.sendButton.addEventListener("click", () => this.handleSendMessage(this.elements.messageInput.value, this.elements.fileInput));

        //send-message
         // Handle sending text messages
         this.elements.sendButton.addEventListener("click", () => this.chatHandler.sendMessage());

         // Handle file inputs
         this.elements.fileInput.addEventListener("change", () => this.chatHandler.sendFile());


        // Video swap
        this.elements.expandButton?.addEventListener('click', () => this._swapVideos());

        // Add touch event listeners for dragging/sliding
        this.elements.mainVideo.addEventListener('touchmove', this._handleTouchStartMain.bind(this));
        this.elements.insetVideo.addEventListener('touchmove', this._handleTouchStartInset.bind(this));

        // Add touch end event listeners to reset layout
        this.elements.mainVideo.addEventListener('touchend', this._handleTouchEndMain.bind(this));
        this.elements.insetVideo.addEventListener('touchend', this._handleTouchEndInset.bind(this));

        // Page unload
        window.addEventListener('beforeunload', () => this._cleanup());

        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this._onPageHidden();
            } else {
                this._onPageVisible();
            }
        });

        document.addEventListener('mousemove', this._showControls.bind(this));
        document.addEventListener('touchstart', this._showControls.bind(this));
        document.addEventListener('mouseleave', this._hideControls.bind(this));
    }

    _showControls() {
        if (!this.elements.videoControls) return;

        this.elements.videoControls.style.opacity = '1';
        this.elements.videoControls.style.visibility = 'visible';

        // Reset the timeout to hide controls after a delay
        clearTimeout(this.elements.hideControlsTimeout);
        this.elements.hideControlsTimeout = setTimeout(() => this._hideControls(), 3000);
    }

    _hideControls() {
        if (!this.elements.videoControls) return;

        this.elements.videoControls.style.opacity = '0';
        this.elements.videoControls.style.visibility = 'hidden';
    }

    // Method to reset video layout
    _resetVideoLayout() {
        // Reset main video to full screen
        this.elements.mainVideo.style.width = '100%';
        this.elements.mainVideo.style.height = '100%';
        this.elements.mainVideo.style.objectFit = 'cover'; // Enforce object-fit as cover to maintain aspect ratio

        // Reset inset video back to its default size
        this.elements.insetVideo.style.width = '110px';  // original inset size
        this.elements.insetVideo.style.height = '130px'; // original inset size

        // Ensure inset video is positioned properly
        this.elements.insetVideo.style.position = 'absolute'; // Ensure absolute positioning
        this.elements.insetVideo.style.top = '2%';
        this.elements.insetVideo.style.right = '2%';
        this.elements.insetVideo.style.borderRadius = '10px'; // Apply the border radius for aesthetics
        this.elements.insetVideo.style.border = '0';

        // Ensure the video section is in the correct layout
        this.elements.videoSection.style.display = 'flex'; // Ensure flexbox layout
        this.elements.videoSection.style.flexDirection = 'row'; // Horizontal layout for large screens
        this.elements.videoSection.style.height = '100%'; // Full height for the video section

        // Optionally reset any other styles that might have been applied dynamically during dragging or resizing
        this.elements.videoSection.style.position = 'relative';
    }

    // Handle the start of touch event on main video and move event
    _handleTouchStartMain(e) {
        this.state.isMainVideoDragged = true;
    }

    // Handle the start of touch event on inset video and move event
    _handleTouchStartInset(e) {
        this.state.startTouchY = e.touches[0].clientY; // Track the starting position of the touch

        // Handle drag of inset video (if dragged down, split layout)
        const touchMoveY = e.touches[0].clientY;
        const dragDistance = touchMoveY - this.state.startTouchY;
        if (!this.state.isInsetVideoDragged) {
            this._resetToSplitLayout(); // Reset layout to split screen

        }
    }

    // Handle the end of touch event on main video
    _handleTouchEndMain() {
        if (this.state.isMainVideoDragged) {
            this.state.isMainVideoDragged = false;
            this._resetVideoLayout();
        }
    }

    // Handle the end of touch event on inset video
    _handleTouchEndInset() {
        if (this.state.isInsetVideoDragged) {
            this.state.isInsetVideoDragged = false;
            this._resetVideoLayout();
            return;
        }
        this.state.isInsetVideoDragged = true;
    }

    // Function to reset the layout to split the screen into two halves
    _resetToSplitLayout() {
        // Reset to full screen (vertical layout for smaller screens)
        this.elements.videoSection.style.display = 'flex'; // Ensure it's a flex container
        this.elements.videoSection.style.flexDirection = 'column'; // Vertical layout
        this.elements.videoSection.style.height = '100%'; // Full height for video section

        // Adjust main video and inset video sizes for small screens (split vertically)
        this.elements.mainVideo.style.width = '100%';  // Full width for main video on small screens
        this.elements.mainVideo.style.height = '50%'; // Take up half height for main video
        this.elements.mainVideo.style.flexShrink = '0'; // Prevent shrinking

        this.elements.insetVideo.style.width = '100%';  // Full width for inset video
        this.elements.insetVideo.style.height = '50%'; // Take up half height for inset video
        this.elements.insetVideo.style.flexShrink = '0'; // Prevent shrinking

        // Ensure both videos are properly styled and visible
        this.elements.mainVideo.style.objectFit = 'cover'; // Maintain aspect ratio for main video
        this.elements.insetVideo.style.objectFit = 'cover'; // Maintain aspect ratio for inset video
        this.elements.insetVideo.style.position = 'relative';

        // Optional: Add smooth transitions for resizing
        this.elements.mainVideo.style.transition = 'all 0.3s ease';
        this.elements.insetVideo.style.transition = 'all 0.3s ease';

    }

    initSubtitles() {
        // Create a caption box dynamically
        this.captionBox = document.createElement('div');
        this.captionBox.classList.add('captionBox');
        this.captionBox.style.display = 'none'; // Start hidden
        this.elements.videoSection.appendChild(this.captionBox);

        // Add event listener for subtitle toggle
        this.elements.subtitleToggle.addEventListener('click', this.toggleSubtitles.bind(this));
    }

    toggleSubtitles() {
        if (this.captionBox.style.display === 'none') {
            this.captionBox.style.display = 'block';
            this.captionBox.innerText = this.state.captions[this.state.currentCaptionIndex];

            // Start looping through captions
            this.state.captionInterval = setInterval(() => {
                this.state.currentCaptionIndex = (this.state.currentCaptionIndex + 1) % this.state.captions.length;
                this.captionBox.innerText = this.state.captions[this.state.currentCaptionIndex];
            }, 3000); // Update every 3 seconds
            this.elements.subtitleToggle.style.filter = 'invert(1)';
        } else {
            this.elements.subtitleToggle.style.filter = 'invert(0)';
            this.captionBox.style.display = 'none';
            clearInterval(this.state.captionInterval); // Stop caption updates
        }
    }

    async handleSendMessage(messageInput, fileInput) {
        const message = messageInput.trim(); // Trim again to be safe
        const files = fileInput.files;
        const meetingId = 123; // Replace with actual meeting ID dynamically
        const userId = 10; // Replace with actual user ID dynamically
        console.log(messageInput)

        if (!message || files.length === 0) {
            alert("Please enter a message or attach a file.");
            return;
        }
        if(!attachments){
            attachments=[];
        } else{
            // Convert files to an array of filenames
        const attachments = Array.from(files).map((file) => file.name);

        }

        // Create payload
        const payload = {
            meetingId,
            userId,
            messages: message ? [message] : [],
            attachments,
        };

        try {
            const response = await fetch("/api/meeting/chat/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const result = await response.json();
            if (response.ok) {
                console.log("Chat updated:", result);
                messageInput.value = ""; // Clear input field
                fileInput.value = ""; // Clear file input
            } else {
                alert(result.error || "Error updating chat");
            }
        } catch (error) {
            console.error("Error:", error);
        }
    }

    _setupWebRTCListeners() {
        this.webrtc.on('initialized', () => {
            this.state.isCallActive = true;
            this.state.callStartTime = Date.now();
            this._startTimer();
            this._updateUIState();
        });

        this.webrtc.on('localStreamReady', () => {
            this._updateUIState();
        });

        this.webrtc.on('remoteStreamConnected', () => {
            this._updateUIState();
        });

        this.webrtc.on('error', ({ type, error }) => {
            this._handleError(type, error);
        });

        this.webrtc.on('peerLeft', () => {
            this._handlePeerLeft();
        });

        this.webrtc.on('reconnecting', ({ attempt }) => {
            this._showReconnecting(attempt);
        });

        this.webrtc.on('audioToggled', ({ enabled }) => {
            this.state.isAudioEnabled = enabled;
            this._updateAudioUI();
        });

        this.webrtc.on('videoToggled', ({ enabled }) => {
            this.state.isVideoEnabled = enabled;
            this._updateVideoUI();
        });
    }

    async _initializeCall() {
        try {
            await this.webrtc.initialize(this.roomId);
        } catch (error) {
            this._handleError('call_initialization', error);
            throw error;
        }
    }

    _startMonitoring() {
        // Monitor connection state
        this.monitorInterval = setInterval(async () => {
            try {
                const status = await this.webrtc.healthCheck();
                if (!status.healthy) {
                    this._handleConnectionIssues(status);
                }
            } catch (error) {
                console.warn('Health check failed:', error);
            }
        }, 5000);
    }

    _handleConnectionIssues(status) {
        // Check specific issues
        if (!status.local.stream) {
            this._showNotification('Local media stream lost', 'error');
        }

        if (status.connection.exists && !['connected', 'completed'].includes(status.connection.iceConnectionState)) {
            this._showNotification('Connection quality issues detected', 'warning');
        }

        if (!status.websocket.connected) {
            this._showNotification('Server connection lost', 'error');
        }
    }

    _stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
    }

    _stopMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        if (this.connectionMonitorInterval) {
            clearInterval(this.connectionMonitorInterval);
        }
    }

    async _toggleVideo() {
        try {
            this.state.isVideoEnabled = await this.webrtc.toggleVideo();
            this._updateVideoUI();
        } catch (error) {
            this._handleError('video_toggle', error);
        }
    }

    async _toggleAudio() {
        try {
            this.state.isAudioEnabled = await this.webrtc.toggleAudio();
            this._updateAudioUI();
        } catch (error) {
            this._handleError('audio_toggle', error);
        }
    }

    async _toggleSpeaker() {
        this.state.isSpeakerEnabled = !this.state.isSpeakerEnabled;
        if (this.elements.remoteVideo) {
            this.elements.remoteVideo.muted = !this.state.isSpeakerEnabled;
        }
        this._updateSpeakerUI();
    }

    async _flipCamera() {
        try {
            await this.webrtc.switchCamera();
        } catch (error) {
            this._handleError('camera_flip', error);
        }
    }

    _toggleChat() {
        this.state.isChatOpen = !this.state.isChatOpen;
        this._updateChatUI();
    }

    _swapVideos() {
        const mainVideo = document.querySelector('.mainVideo');
        const insetVideo = this.elements.insetVideo;

        if (!mainVideo || !insetVideo) return;

        // Swap video sources
        const tempSrc = this.elements.localVideo.srcObject;
        this.elements.localVideo.srcObject = this.elements.remoteVideo.srcObject;
        this.elements.remoteVideo.srcObject = tempSrc;

        // Update state and UI
        this.state.isVideoSwapped = !this.state.isVideoSwapped;
        mainVideo.classList.toggle('swapped');
        insetVideo.classList.toggle('swapped');
    }

    _updateVideoUI() {
        if (this.elements.videoButton) {
            const iconVisible = this.elements.videoButton.querySelector('.icon-visible-video');
            const iconHidden = this.elements.videoButton.querySelector('.icon-hidden');

            if (iconVisible) iconVisible.style.display = this.state.isVideoEnabled ? 'block' : 'none';
            if (iconHidden) iconHidden.style.display = this.state.isVideoEnabled ? 'none' : 'block';

            this.elements.videoButton.style.backgroundColor = this.state.isVideoEnabled ? '' : 'red';
        }
    }

    _updateAudioUI() {
        if (this.elements.micButton) {
            const iconVisible = this.elements.micButton.querySelector('.icon-visible-mic');
            const iconHidden = this.elements.micButton.querySelector('.icon-hidden');

            if (iconVisible) iconVisible.style.display = this.state.isAudioEnabled ? 'block' : 'none';
            if (iconHidden) iconHidden.style.display = this.state.isAudioEnabled ? 'none' : 'block';

            this.elements.micButton.style.backgroundColor = this.state.isAudioEnabled ? '' : 'red';
        }
    }

    _updateSpeakerUI() {
        if (this.elements.speakerButton) {
            const iconVisible = this.elements.speakerButton.querySelector('.icon-visible-volume');
            const iconHidden = this.elements.speakerButton.querySelector('.icon-hidden');

            if (iconVisible) iconVisible.style.display = this.state.isSpeakerEnabled ? 'block' : 'none';
            if (iconHidden) iconHidden.style.display = this.state.isSpeakerEnabled ? 'none' : 'block';

            this.elements.speakerButton.style.backgroundColor = this.state.isSpeakerEnabled ? '' : 'red';
        }
    }

    _updateChatUI() {
        if (this.elements.chatSection) {
            this.elements.chatSection.classList.toggle('expanded', this.state.isChatOpen);
            this.elements.chatSection.classList.toggle('hidden', !this.state.isChatOpen);
        }

        if (this.elements.videoSection) {
            this.elements.videoSection.classList.toggle('compressed', this.state.isChatOpen);
        }

        if (this.elements.messageButton) {
            this.elements.messageButton.classList.toggle('active', this.state.isChatOpen);
        }
    }

    _updateUIState() {
        this._updateVideoUI();
        this._updateAudioUI();
        this._updateSpeakerUI();
        this._updateChatUI();

        // Update inset video visibility
        if (this.elements.insetVideo) {
            const hasRemoteStream = this.elements.remoteVideo?.srcObject !== null;
            this.elements.insetVideo.style.display = hasRemoteStream ? 'block' : 'none';
        }
    }

    _startTimer() {
        if (!this.elements.timer) return;

        const updateTimer = () => {
            if (!this.state.callStartTime) return;

            const elapsed = Math.floor((Date.now() - this.state.callStartTime) / 1000);
            const hours = Math.floor(elapsed / 3600);
            const minutes = Math.floor((elapsed % 3600) / 60);
            const seconds = elapsed % 60;

            this.elements.timer.textContent =
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

        updateTimer();
        this.timerInterval = setInterval(updateTimer, 1000);
    }

    _stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.elements.timer) {
            this.elements.timer.textContent = '00:00:00';
        }
    }

    _handleError(type, error) {
        console.error(`UI Error (${type}):`, error);

        let message;
        switch (type) {
            case 'media':
                message = 'Could not access camera or microphone';
                break;
            case 'connection':
                message = 'Connection error occurred';
                break;
            case 'initialization':
                message = 'Failed to start video call';
                break;
            default:
                message = 'An error occurred';
        }

        this._showNotification(message, 'error');
    }

    _handleHealthIssues(issues) {
        issues.forEach(issue => {
            this._showNotification(issue, 'warning');
        });
    }

    _handlePeerLeft() {
        this._showNotification('Other participant left the call', 'info');
        this._updateUIState();
    }

    _showReconnecting(attempt) {
        this._showNotification(`Reconnecting... (Attempt ${attempt})`, 'warning');
    }

    _showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        // Add to DOM
        document.body.appendChild(notification);

        // Remove after delay
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    _onPageHidden() {
        // Handle page visibility change (e.g., user switches tabs)
        if (this.state.isCallActive) {
            this._showNotification('Call running in background', 'info');
        }
    }

    _onPageVisible() {
        // Handle page becoming visible again
        if (this.state.isCallActive) {
            this._checkConnectionStatus();
        }
    }

    async _checkConnectionStatus() {
        const health = await this.webrtc.healthCheck();
        if (!health.healthy) {
            this._handleHealthIssues(health.health.issues);
        }
    }

    async _endCall() {
        try {
            this._stopTimer();
            this._stopMonitoring();
            await this.webrtc.cleanup();
            window.location.href = '/';
        } catch (error) {
            this._handleError('end_call', error);
        }
    }

    async _cleanup() {
        // Store bound event listeners to remove them
        const boundBeforeUnload = this._cleanup.bind(this);
        const boundVisibilityChange = () => {
            if (document.hidden) {
                this._onPageHidden();
            } else {
                this._onPageVisible();
            }
        };

        // Remove event listeners
        window.removeEventListener('beforeunload', boundBeforeUnload);
        document.removeEventListener('visibilitychange', boundVisibilityChange);

        // Clear intervals
        this._stopMonitoring();
        this._stopTimer();

        // Clean up WebRTC
        if (this.webrtc) {
            await this.webrtc.cleanup();
            this.webrtc = null;
        }

        // Clear DOM references
        this.elements = null;

        // Clear state
        this.state = null;
    }
}

// Initialize the UI controller when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.uiController = new UIController();
    window.uiController.initialize().catch(error => {
        console.error('Failed to initialize UI controller:', error);
    });
});

export default UIController;