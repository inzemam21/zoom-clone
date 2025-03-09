const joinButton = document.getElementById('joinButton');
const muteButton = document.getElementById('muteButton');
const videoButton = document.getElementById('videoButton');
const leaveButton = document.getElementById('leaveButton');
const statusDiv = document.getElementById('status');
const localVideo = document.getElementById('localVideo');
const logDiv = document.getElementById('log');
const preCall = document.getElementById('preCall');
const callScreen = document.getElementById('callScreen');
const roomInput = document.getElementById('roomInput');
const roomName = document.getElementById('roomName');
const videoGrid = document.getElementById('videoGrid');
let localStream;

export function setupUI(startCallCallback, endCallCallback, toggleMuteCallback, toggleVideoCallback) {
    joinButton.onclick = () => {
        const room = roomInput.value.trim();
        if (!room) {
            logError('Please enter a room name');
            return;
        }
        startCallCallback(room);
    };

    muteButton.onclick = () => toggleMuteCallback();
    videoButton.onclick = () => toggleVideoCallback();
    leaveButton.onclick = () => endCallCallback();
}

export function logError(message) {
    logDiv.textContent = `Error: ${message}`;
    console.error(message);
}

export function updateStatus(message) {
    statusDiv.textContent = `Status: ${message}`;
}

export function showCallScreen(room) {
    preCall.style.display = 'none';
    callScreen.style.display = 'flex';
    roomName.textContent = `Room: ${room}`;
}

export function showPreCall() {
    preCall.style.display = 'flex';
    callScreen.style.display = 'none';
    statusDiv.textContent = 'Status: Not connected';
    logDiv.textContent = '';
    while (videoGrid.children.length > 1) {
        videoGrid.removeChild(videoGrid.lastChild);
    }
}

export function setLocalStream(stream) {
    localStream = stream;
    localVideo.srcObject = stream;
}

export function addRemoteVideo(peerId, stream) {
    if (!document.getElementById(`video-${peerId}`)) {
        const remoteVideo = document.createElement('video');
        remoteVideo.id = `video-${peerId}`;
        remoteVideo.autoplay = true;
        remoteVideo.playsinline = true;
        remoteVideo.srcObject = stream;

        const videoWrapper = document.createElement('div');
        videoWrapper.className = 'video-wrapper';
        videoWrapper.id = `wrapper-${peerId}`;
        videoWrapper.appendChild(remoteVideo);

        const label = document.createElement('span');
        label.className = 'video-label';
        label.textContent = `Participant (${peerId})`;
        videoWrapper.appendChild(label);

        videoGrid.appendChild(videoWrapper);
    }
}

export function removeRemoteVideo(peerId) {
    const wrapper = document.getElementById(`wrapper-${peerId}`);
    if (wrapper) {
        videoGrid.removeChild(wrapper);
    }
}

export function toggleMute() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        muteButton.classList.toggle('off', !audioTrack.enabled);
        muteButton.classList.toggle('active', audioTrack.enabled);
    }
}

export function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled;
        videoButton.classList.toggle('off', !videoTrack.enabled);
        videoButton.classList.toggle('active', videoTrack.enabled);
    }
}