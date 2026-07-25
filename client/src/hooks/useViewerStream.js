import { useEffect, useRef, useState } from 'react';
import { createRealtimeConnection } from '../services/realtime';

export function useViewerStream(selectedCameraId, onRealtimeUpdate) {
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const selectedCameraRef = useRef(selectedCameraId);
  const [streamActive, setStreamActive] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [onlineCameras, setOnlineCameras] = useState([]);
  const [lastMotionAlert, setLastMotionAlert] = useState(null);

  useEffect(() => {
    selectedCameraRef.current = selectedCameraId;
  }, [selectedCameraId]);

  useEffect(() => {
    const socket = createRealtimeConnection();
    socketRef.current = socket;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    peerConnectionRef.current = pc;

    socket.on('connect', () => {
      socket.emit('register', {
        id: `dashboard-viewer-${socket.id}`,
        name: 'Dashboard Viewer',
        role: 'viewer',
      });
      if (selectedCameraRef.current) {
        socket.emit('join-camera-view', { cameraId: selectedCameraRef.current });
      }
    });

    pc.ontrack = (event) => {
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        setStreamActive(true);
      }
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate || !selectedCameraRef.current) return;
      socket.emit('ice-candidate', {
        cameraId: selectedCameraRef.current,
        viewerSocketId: socket.id,
        candidate: event.candidate,
        direction: 'viewer-to-camera',
      });
    };

    socket.on('camera-offer', async ({ offer, cameraId }) => {
      if (!selectedCameraRef.current || cameraId !== selectedCameraRef.current) return;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('camera-answer', {
        cameraId,
        viewerSocketId: socket.id,
        answer,
      });
    });

    socket.on('ice-candidate', async ({ candidate, cameraId, direction }) => {
      if (!selectedCameraRef.current || cameraId !== selectedCameraRef.current || direction !== 'camera-to-viewer') return;
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('camera-status', ({ cameras }) => {
      setOnlineCameras(cameras);
    });

    socket.on('motion-alert', (event) => {
      setLastMotionAlert(event);
      onRealtimeUpdate?.();
    });

    socket.on('recording-created', () => {
      onRealtimeUpdate?.();
    });

    return () => {
      if (selectedCameraRef.current) {
        socket.emit('leave-camera-view', { cameraId: selectedCameraRef.current });
      }
      socket.disconnect();
      pc.close();
    };
  }, [onRealtimeUpdate]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !selectedCameraId) return;
    setStreamActive(false);
    socket.emit('join-camera-view', { cameraId: selectedCameraId });

    return () => {
      socket.emit('leave-camera-view', { cameraId: selectedCameraId });
    };
  }, [selectedCameraId]);

  function toggleMute() {
    if (!videoRef.current) return;
    const next = !isMuted;
    videoRef.current.muted = next;
    setIsMuted(next);
  }

  function takeScreenshot() {
    if (!videoRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const context = canvas.getContext('2d');
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  async function toggleFullscreen() {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await videoRef.current.requestFullscreen();
  }

  return {
    videoRef,
    streamActive,
    isMuted,
    onlineCameras,
    lastMotionAlert,
    toggleMute,
    takeScreenshot,
    toggleFullscreen,
  };
}
