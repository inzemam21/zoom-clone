// WebRTC-related functions
const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export async function initiateCall(socket, onTrackCallback, onStateChangeCallback) {
    if (!navigator.mediaDevices) {
        throw new Error('navigator.mediaDevices is undefined - likely due to insecure context');
    }

    const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    console.log('Local stream added');

    const peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
        console.log('Added track:', track.kind);
    });

    peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        onTrackCallback(event.streams[0]);
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
        onStateChangeCallback(peerConnection.connectionState);
    };

    const offer = await peerConnection.createOffer();
    console.log('Created offer:', offer.sdp);
    await peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify({
        type: 'offer',
        data: offer.sdp
    }));

    return { peerConnection, localStream };
}

export async function handleSignal(signal, peerConnection, socket) {
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
        throw new Error(`Signal handling failed: ${error.message}`);
    }
}

export function closeConnection(peerConnection, localStream, socket) {
    if (peerConnection) {
        peerConnection.close();
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (socket) {
        socket.close();
    }
}