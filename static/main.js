import { setupUI, logError, updateStatus, showCallScreen, showPreCall, setLocalStream, addRemoteVideo, removeRemoteVideo, toggleMute, toggleVideo } from './ui.js';
import { createPeerConnection, initiateOffer, handleSignal, closePeerConnection } from './webrtc.js';

let socket;
let peers = new Map();
let selfId = Math.random().toString(36).substring(2, 15);
let username;
let localStream;

function startCall(room, user) {
    username = user;
    socket = new WebSocket(`wss://${window.location.hostname}:8080/ws?room=${room}`);

    socket.onopen = async () => {
        console.log('WebSocket connected, selfId:', selfId);
        updateStatus('WebSocket connected');
        showCallScreen(room);
        await initiateSelf(room);
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'join',
                room: room,
                from: selfId,
                to: '',
                username: username
            }));
            console.log('Sent join announcement');
            await broadcastOffers(room);
        }
    };

    socket.onmessage = (event) => {
        console.log('Raw message received:', event.data);
        let signal;
        try {
            signal = JSON.parse(event.data);
        } catch (error) {
            console.error('Failed to parse message:', error);
            return;
        }
        console.log('Parsed signal:', signal);
        if (signal.from === selfId) {
            console.log('Ignoring own message');
            return;
        }
        handleSignalMessage(signal, room);
    };

    socket.onerror = (error) => {
        logError('WebSocket error: ' + error.message);
        console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
        console.log('WebSocket closed');
        endCall();
    };
}

async function initiateSelf(room) {
    try {
        const { peerConnection, localStream: stream } = await createPeerConnection(
            socket,
            room,
            selfId,
            selfId,
            (peerId, stream) => {
                console.log('ontrack triggered for', peerId);
                addRemoteVideo(peerId, stream, peers.get(peerId)?.username);
            },
            (peerId, state) => handleStateChange(peerId, state, room)
        );
        localStream = stream;
        peers.set(selfId, { peerConnection: null, localStream, username });
        setLocalStream(localStream, username);
        updateStatus('Connected');
        console.log('Self initialized, peers:', peers.size);
    } catch (error) {
        logError(error.message);
    }
}

async function handleSignalMessage(signal, room) {
    console.log('Handling signal from', signal.from, ':', signal.type);
    let peer = peers.get(signal.from);
    let peerConnection = peer?.peerConnection;

    if (signal.type === 'join') {
        console.log('Peer joined:', signal.from);
        if (!peers.has(signal.from)) {
            await addPeer(signal.from, room);
        }
        peers.set(signal.from, { ...peers.get(signal.from), username: signal.username });
        const wrapper = document.getElementById(`video-${signal.from}`);
        if (wrapper && signal.username) {
            wrapper.querySelector('.video-label').textContent = signal.username;
        }
        await broadcastOffers(room);
        return;
    }

    if (!peer && signal.type === 'offer') {
        console.log('New peer detected:', signal.from);
        try {
            const { peerConnection: pc, localStream } = await createPeerConnection(
                socket,
                room,
                signal.from,
                selfId,
                (peerId, stream) => {
                    console.log('ontrack triggered for', peerId);
                    addRemoteVideo(peerId, stream, peers.get(peerId)?.username);
                },
                (peerId, state) => handleStateChange(peerId, state, room)
            );
            peers.set(signal.from, { peerConnection: pc, localStream, username: signal.username });
            peerConnection = pc;
            await handleSignal(signal, peerConnection, socket, room, selfId);
            console.log('Handled offer from', signal.from);
        } catch (error) {
            logError(error.message);
        }
    } else if (peerConnection) {
        try {
            await handleSignal(signal, peerConnection, socket, room, selfId);
            console.log('Handled signal from', signal.from, ':', signal.type);
        } catch (error) {
            logError(error.message);
        }
    }
}

async function addPeer(peerId, room) {
    if (!peers.has(peerId)) {
        console.log('Adding peer:', peerId);
        try {
            const { peerConnection: pc, localStream } = await createPeerConnection(
                socket,
                room,
                peerId,
                selfId,
                (peerId, stream) => {
                    console.log('ontrack triggered for', peerId);
                    addRemoteVideo(peerId, stream, peers.get(peerId)?.username);
                },
                (peerId, state) => handleStateChange(peerId, state, room)
            );
            peers.set(peerId, { peerConnection: pc, localStream });
            console.log('Peer connection created for', peerId);
            await initiateOffer(pc, socket, room, peerId, selfId);
            console.log('Added and offered to peer', peerId);
        } catch (error) {
            logError(error.message);
        }
    }
}

async function broadcastOffers(room) {
    console.log('Broadcasting offers to peers:', peers.size - 1);
    for (const [id] of peers) {
        if (id !== selfId && !peers.get(id).peerConnection) {
            await addPeer(id, room);
        }
    }
}

function handleStateChange(peerId, state, room) {
    updateStatus(`${peers.size - 1} peers connected`);
    if (state === 'disconnected' || state === 'closed') {
        console.log('Peer', peerId, 'disconnected');
        removeRemoteVideo(peerId);
        peers.delete(peerId);
        if (peers.size === 1) updateStatus('Connected (alone)');
        broadcastOffers(room);
    }
}

function endCall() {
    peers.forEach((peer) => closePeerConnection(peer.peerConnection, peer.localStream));
    peers.clear();
    if (socket) socket.close();
    showPreCall();
}

setupUI(
    (room, username) => startCall(room, username),
    endCall,
    () => toggleMute(localStream),
    () => toggleVideo(localStream)
);