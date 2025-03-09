export function setupUI(startCall, endCall, toggleMuteCallback, toggleVideoCallback, toggleScreenCallback) {
    const preCall = document.getElementById('preCall');
    const callScreen = document.getElementById('callScreen');
    const joinBtn = document.getElementById('joinButton');
    const leaveBtn = document.getElementById('leaveButton');
    const roomInput = document.getElementById('roomInput');
    const usernameInput = document.getElementById('usernameInput');
    const muteBtn = document.getElementById('muteButton');
    const videoBtn = document.getElementById('videoButton');
    const screenBtn = document.getElementById('screenButton');
    let isMuted = false;
    let isVideoOn = true;
    let isScreenSharing = false;

    joinBtn.addEventListener('click', () => {
        const room = roomInput.value.trim();
        const username = usernameInput.value.trim() || 'Anonymous';
        if (room) {
            startCall(room, username);
        }
    });

    leaveBtn.addEventListener('click', endCall);

    muteBtn.addEventListener('click', () => {
        toggleMuteCallback();
        isMuted = !isMuted;
        muteBtn.classList.toggle('active', !isMuted);
        muteBtn.classList.toggle('off', isMuted);
        muteBtn.querySelector('i').className = isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
    });

    videoBtn.addEventListener('click', () => {
        toggleVideoCallback();
        isVideoOn = !isVideoOn;
        videoBtn.classList.toggle('active', isVideoOn);
        videoBtn.classList.toggle('off', !isVideoOn);
        videoBtn.querySelector('i').className = isVideoOn ? 'fas fa-video' : 'fas fa-video-slash';
    });

    screenBtn.addEventListener('click', () => {
        toggleScreenCallback();
        isScreenSharing = !isScreenSharing;
        screenBtn.classList.toggle('active', isScreenSharing);
        screenBtn.classList.toggle('off', !isScreenSharing);
        screenBtn.classList.toggle('screen', isScreenSharing);
        screenBtn.querySelector('i').className = isScreenSharing ? 'fas fa-desktop' : 'fas fa-desktop';
    });
}

export function logError(message) {
    const log = document.getElementById('log');
    log.textContent = `Error: ${message}`;
}

export function updateStatus(message) {
    document.getElementById('status').textContent = `Status: ${message}`;
}

export function showCallScreen(room) {
    const preCall = document.getElementById('preCall');
    const callScreen = document.getElementById('callScreen');
    preCall.classList.add('hidden');
    callScreen.classList.add('active');
    document.getElementById('roomName').textContent = `Room: ${room}`;
}

export function showPreCall() {
    document.getElementById('callScreen').classList.remove('active');
    document.getElementById('preCall').classList.remove('hidden');
}

export function setLocalStream(stream, username) {
    const videoGrid = document.getElementById('videoGrid');
    const localWrapper = document.createElement('div');
    localWrapper.className = 'video-wrapper';
    const videoElement = document.createElement('video');
    const label = document.createElement('span');
    videoElement.srcObject = stream;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.muted = true;
    label.className = 'video-label';
    label.textContent = username || 'You';
    localWrapper.appendChild(videoElement);
    localWrapper.appendChild(label);
    videoGrid.innerHTML = '';
    videoGrid.appendChild(localWrapper);
}

export function addRemoteVideo(peerId, stream, username) {
    const videoGrid = document.getElementById('videoGrid');
    let wrapper = document.getElementById(`video-${peerId}`);
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = `video-${peerId}`;
        wrapper.className = 'video-wrapper';
        const videoElement = document.createElement('video');
        const label = document.createElement('span');
        videoElement.srcObject = stream;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        label.className = 'video-label';
        label.textContent = username || peerId;
        wrapper.appendChild(videoElement);
        wrapper.appendChild(label);
        videoGrid.appendChild(wrapper);
    }
}

export function removeRemoteVideo(peerId) {
    const wrapper = document.getElementById(`video-${peerId}`);
    if (wrapper) wrapper.remove();
}

export function toggleMute(stream) {
    if (stream) {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            console.log('Audio muted:', !audioTrack.enabled);
        }
    }
}

export function toggleVideo(stream) {
    if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            console.log('Video muted:', !videoTrack.enabled);
        }
    }
}