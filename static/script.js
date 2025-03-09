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
let peerConnection;
let localStream;
let socket;
let remoteVideoExists = false;

function logError(message) {
    logDiv.textContent = `Error: ${message}`;
    console.error(message);
}

joinButton.onclick = () => {
    const room = roomInput.value.trim();
    if (!room) {
        logError('Please enter a room name');
        return;
    }
    startCall(room);
};

function startCall(room) {
    socket = new WebSocket(`wss://${window.location.hostname}:8080/ws`);

    socket.onopen = () => {
        console.log('WebSocket connected');
        statusDiv.textContent = 'Status: WebSocket connected';
        preCall.style.display = 'none';
        callScreen.style.display = 'flex';
        roomName.textContent = `Room: ${room}`;
        initiateCall();
    };

    socket.onmessage = (event) => {
        console.log('Received:', event.data);
        const signal = JSON.parse(event.data);
        handleSignal(signal);
    };

    socket.onerror = (error) => {
        logError('WebSocket error');
    };

    socket.onclose = () => {
        console.log('WebSocket closed');
        statusDiv.textContent = 'Status: WebSocket closed';
        endCall();
    };
}

const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

async function initiateCall() {
    if (!navigator.mediaDevices) {
        logError('navigator.mediaDevices is undefined - likely due to insecure context');
        return;
    }
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        console.log('Local stream added');

        peerConnection = new RTCPeerConnection(config);
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
            console.log('Added track:', track.kind);
        });

        peerConnection.ontrack = (event) => {
            console.log('Received remote track:', event.track.kind);
            if (!remoteVideoExists) {
                const remoteVideo = document.createElement('video');
                remoteVideo.id = 'remoteVideo';
                remoteVideo.autoplay = true;
                remoteVideo.playsinline = true;
                remoteVideo.srcObject = event.streams[0];

                const videoWrapper = document.createElement('div');
                videoWrapper.className = 'video-wrapper';
                videoWrapper.appendChild(remoteVideo);

                const label = document.createElement('span');
                label.className = 'video-label';
                label.textContent = 'Participant';
                videoWrapper.appendChild(label);

                videoGrid.appendChild(videoWrapper);
                remoteVideoExists = true;
            }
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate:', event.candidate);
                socket.send(JSON.stringify({
                    type: 'candidate',
                    data: JSON.stringify(event.candidate)
                }));
            }
        };

        peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnection.connectionState);
            statusDiv.textContent = `Status: ${peerConnection.connectionState}`;
            if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'closed') {
                removeRemoteVideo();
            }
        };

        const offer = await peerConnection.createOffer();
        console.log('Created offer:', offer.sdp);
        await peerConnection.setLocalDescription(offer);
        socket.send(JSON.stringify({
            type: 'offer',
            data: offer.sdp
        }));
    } catch (error) {
        logError(`Starting call failed: ${error.message}`);
    }
}

async function handleSignal(signal) {
    if (!peerConnection) {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localVideo.srcObject = localStream;
            console.log('Local stream added');

            peerConnection = new RTCPeerConnection(config);
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
                console.log('Added track:', track.kind);
            });

            peerConnection.ontrack = (event) => {
                console.log('Received remote track:', event.track.kind);
                if (!remoteVideoExists) {
                    const remoteVideo = document.createElement('video');
                    remoteVideo.id = 'remoteVideo';
                    remoteVideo.autoplay = true;
                    remoteVideo.playsinline = true;
                    remoteVideo.srcObject = event.streams[0];

                    const videoWrapper = document.createElement('div');
                    videoWrapper.className = 'video-wrapper';
                    videoWrapper.appendChild(remoteVideo);

                    const label = document.createElement('span');
                    label.className = 'video-label';
                    label.textContent = 'Participant';
                    videoWrapper.appendChild(label);

                    videoGrid.appendChild(videoWrapper);
                    remoteVideoExists = true;
                }
            };

            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('Sending ICE candidate:', event.candidate);
                    socket.send(JSON.stringify({
                        type: 'candidate',
                        data: JSON.stringify(event.candidate)
                    }));
                }
            };

            peerConnection.onconnectionstatechange = () => {
                console.log('Connection state:', peerConnection.connectionState);
                statusDiv.textContent = `Status: ${peerConnection.connectionState}`;
                if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'closed') {
                    removeRemoteVideo();
                }
            };
        } catch (error) {
            logError(`Initializing peer failed: ${error.message}`);
            return;
        }
    }

    try {
        switch (signal.type) {
            case 'offer':
                console.log('Received offer:', signal.data);
                await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.data }));
                const answer = await peerConnection.createAnswer();
                console.log('Created answer:', answer.sdp);
                await peerConnection.setLocalDescription(answer);
                socket.send(JSON.stringify({
                    type: 'answer',
                    data: answer.sdp
                }));
                break;

            case 'answer':
                console.log('Received answer:', signal.data);
                await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.data }));
                break;

            case 'candidate':
                const candidate = JSON.parse(signal.data);
                console.log('Received ICE candidate:', candidate);
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                break;
        }
    } catch (error) {
        logError(`Signal handling failed: ${error.message}`);
    }
}

muteButton.onclick = () => {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        muteButton.classList.toggle('off', !audioTrack.enabled);
        muteButton.classList.toggle('active', audioTrack.enabled);
    }
};

videoButton.onclick = () => {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled;
        videoButton.classList.toggle('off', !videoTrack.enabled);
        videoButton.classList.toggle('active', videoTrack.enabled);
    }
};

leaveButton.onclick = () => {
    endCall();
};

function endCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (socket) {
        socket.close();
    }
    while (videoGrid.children.length > 1) {
        videoGrid.removeChild(videoGrid.lastChild);
    }
    preCall.style.display = 'flex';
    callScreen.style.display = 'none';
    statusDiv.textContent = 'Status: Not connected';
    logDiv.textContent = '';
    remoteVideoExists = false;
}

function removeRemoteVideo() {
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo && remoteVideo.parentElement) {
        videoGrid.removeChild(remoteVideo.parentElement);
        remoteVideoExists = false;
        statusDiv.textContent = 'Status: Connected (alone)';
    }
}