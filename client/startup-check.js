class StartupCheck {
    static async performChecks() {
        const checks = {
            webrtc: this._checkWebRTC(),
            websocket: this._checkWebSocket(),
            mediaDevices: await this._checkMediaDevices(),
            domElements: this._checkRequiredDOMElements()
        };

        const failed = Object.entries(checks)
            .filter(([_, passed]) => !passed)
            .map(([name]) => name);

        if (failed.length > 0) {
            throw new Error(`Startup checks failed for: ${failed.join(', ')}`);
        }

        return true;
    }

    static _checkWebRTC() {
        return !!(
            window.RTCPeerConnection &&
            window.RTCSessionDescription &&
            window.RTCIceCandidate
        );
    }

    static _checkWebSocket() {
        return !!window.WebSocket;
    }

    static async _checkMediaDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return false;
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasVideo = devices.some(device => device.kind === 'videoinput');
            const hasAudio = devices.some(device => device.kind === 'audioinput');
            return hasVideo && hasAudio;
        } catch {
            return false;
        }
    }

    static _checkRequiredDOMElements() {
        const required = [
            'localVideo',
            'remoteVideo',
            'timer'
        ];

        return required.every(id => !!document.getElementById(id));
    }

    static getErrorMessage(failed) {
        const messages = {
            webrtc: 'WebRTC is not supported in this browser',
            websocket: 'WebSocket is not supported in this browser',
            mediaDevices: 'Camera and microphone access is not available',
            domElements: 'Required page elements are missing'
        };

        return failed.map(check => messages[check] || 'Unknown error').join('. ');
    }
}

export default StartupCheck;