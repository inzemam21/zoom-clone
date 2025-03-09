// Main entry point and coordination
import { setupUI, logError, updateStatus, showCallScreen, showPreCall, setLocalStream, addRemoteVideo, removeRemoteVideo, toggleMute, toggleVideo } from './ui.js';
import { initiateCall, handleSignal, closeConnection } from './webrtc.js';

let peerConnection;
let localStream;
let socket;
let remoteVideoExists = false;

function startCall(room) {
    socket = new WebSocket(`wss://${window.location.hostname}:8080/ws`);

    socket.onopen = () => {
        console.log('WebSocket connected');
        updateStatus('WebSocket connected');
        showCallScreen(room);
        initiateCallHandler();
    };

    socket.onmessage = (event) => {
        console.log('Received:', event.data);
        const signal = JSON.parse(event.data);
        handleSignalHandler(signal);
    };

    socket.onerror = () => logError('WebSocket error');

    socket.onclose = () => {
        console.log('WebSocket closed');
        endCall();
    };
}

async function initiateCallHandler() {
    try {
        const { peerConnection: pc, localStream: stream } = await initiateCall(
            socket,
            (stream) => {
                if (!remoteVideoExists) {
                    addRemoteVideo(stream);
                    remoteVideoExists = true;
                }
            },
            (state) => {
                updateStatus(state);
                if (state === 'disconnected' || state === 'closed') {
                    removeRemoteVideo();
                    remoteVideoExists = false;
                }
            }
        );
        peerConnection = pc;
        localStream = stream;
        setLocalStream(stream);
    } catch (error) {
        logError(error.message);
    }
}

async function handleSignalHandler(signal) {
    if (!peerConnection) {
        try {
            const { peerConnection: pc, localStream: stream } = await initiateCall(
                socket,
                (stream) => {
                    if (!remoteVideoExists) {
                        addRemoteVideo(stream);
                        remoteVideoExists = true;
                    }
                },
                (state) => {
                    updateStatus(state);
                    if (state === 'disconnected' || state === 'closed') {
                        removeRemoteVideo();
                        remoteVideoExists = false;
                    }
                }
            );
            peerConnection = pc;
            localStream = stream;
            setLocalStream(stream);
        } catch (error) {
            logError(error.message);
            return;
        }
    }
    await handleSignal(signal, peerConnection, socket);
}

function endCall() {
    closeConnection(peerConnection, localStream, socket);
    peerConnection = null;
    localStream = null;
    socket = null;
    remoteVideoExists = false;
    showPreCall();
}

// Initialize UI with callbacks
setupUI(startCall, endCall, toggleMute, toggleVideo);