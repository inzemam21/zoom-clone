const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export async function createPeerConnection(socket, room, peerId, selfId, onTrackCallback, onStateChangeCallback) {
    if (!navigator.mediaDevices) {
        throw new Error('navigator.mediaDevices is undefined - likely due to insecure context');
    }

    let localStream;
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log('Local stream added successfully');
    } catch (error) {
        console.error('getUserMedia failed:', error.message);
        throw new Error(`getUserMedia failed: ${error.message}`);
    }

    const peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
        console.log('Added track:', track.kind);
    });

    peerConnection.ontrack = (event) => {
        console.log('Received remote track from', peerId, ':', event.track.kind);
        onTrackCallback(peerId, event.streams[0]);
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('Sending ICE candidate to', peerId, ':', event.candidate);
            socket.send(JSON.stringify({
                type: 'candidate',
                data: JSON.stringify(event.candidate),
                room: room,
                from: selfId,
                to: peerId
            }));
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state with', peerId, ':', peerConnection.connectionState);
        onStateChangeCallback(peerId, peerConnection.connectionState);
    };

    return { peerConnection, localStream };
}

export async function initiateOffer(peerConnection, socket, room, peerId, selfId) {
    const offer = await peerConnection.createOffer();
    console.log('Created offer for', peerId, ':', offer.sdp);
    await peerConnection.setLocalDescription(offer);
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'offer',
            data: offer.sdp,
            room: room,
            from: selfId,
            to: peerId
        }));
        console.log('Sent offer to', peerId);
    } else {
        console.error('WebSocket not open for offer to', peerId);
    }
}

export async function handleSignal(signal, peerConnection, socket, room, selfId) {
    try {
        console.log('Handling signal type:', signal.type, 'from:', signal.from);
        switch (signal.type) {
            case 'offer':
                console.log('Received offer from', signal.from, ':', signal.data);
                await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.data }));
                const answer = await peerConnection.createAnswer();
                console.log('Created answer for', signal.from, ':', answer.sdp);
                await peerConnection.setLocalDescription(answer);
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                        type: 'answer',
                        data: answer.sdp,
                        room: room,
                        from: selfId,
                        to: signal.from
                    }));
                    console.log('Sent answer to', signal.from);
                } else {
                    console.error('WebSocket not open for answer to', signal.from);
                }
                break;

            case 'answer':
                console.log('Received answer from', signal.from, ':', signal.data);
                await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.data }));
                break;

            case 'candidate':
                const candidate = JSON.parse(signal.data);
                console.log('Received ICE candidate from', signal.from, ':', candidate);
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                break;
        }
    } catch (error) {
        console.error('Signal handling failed:', error.message);
        throw new Error(`Signal handling failed: ${error.message}`);
    }
}

export function closePeerConnection(peerConnection, localStream) {
    if (peerConnection) {
        peerConnection.close();
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
}