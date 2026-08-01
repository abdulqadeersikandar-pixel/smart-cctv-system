import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRealtimeConnection } from '../services/realtime';
import { useAppState } from './useAppState';

function ensurePeerConnection(peersRef, cameraId, socket, getIceServers) {
  const existing = peersRef.current.get(cameraId);
  if (existing) return existing;

  const iceServers = (typeof getIceServers === 'function' ? getIceServers() : []) || [];
  const pc = new RTCPeerConnection({
    iceServers: iceServers.length ? iceServers : [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  });

  pc.onicecandidate = (event) => {
    if (!event.candidate || !socket.id) return;
    socket.emit('ice-candidate', {
      cameraId,
      viewerSocketId: socket.id,
      candidate: event.candidate,
      direction: 'viewer-to-camera',
    });
  };

  peersRef.current.set(cameraId, pc);
  return pc;
}

export function useViewerStream(selectedCameraIds, onRealtimeUpdate) {
  const { state, dispatch } = useAppState();
  const socketRef = useRef(null);
  const peersRef = useRef(new Map());
  const streamByCameraRef = useRef(new Map());
  const [streamVersion, setStreamVersion] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const selectedRef = useRef(selectedCameraIds);
  const reconnectProbeRef = useRef(null);
  const videoElementsRef = useRef(new Map());
  const previousSelectedRef = useRef([]);
  const iceServersRef = useRef([]);

  useEffect(() => {
    selectedRef.current = selectedCameraIds;
  }, [selectedCameraIds]);

  const reconnectCamera = useCallback((cameraId) => {
    const socket = socketRef.current;
    if (!socket?.connected || !cameraId) return;
    socket.emit('join-camera-view', { cameraId });
    socket.emit('request-camera-offer', { cameraId, viewerSocketId: socket.id });
  }, []);

  useEffect(() => {
      const socket = createRealtimeConnection();
    socketRef.current = socket;
n    // try to fetch ICE server config from backend so TURN/STUN can be configured centrally

    socket.on('connect', async () => {
      // fetch server side webrtc config (iceServers)
      try {
        const res = await fetch('/api/webrtc/config');
        if (res.ok) {
          const data = await res.json();
          if (data?.iceServers) {
            iceServersRef.current = data.iceServers;
          }
        }
      } catch (e) {
        // ignore; fallback to default STUN servers below
        console.warn('Failed to fetch ICE servers from backend, using default STUNs.');
      }

      socket.emit('register', {
        id: `dashboard-viewer-${socket.id}`,
        name: 'Dashboard Viewer',
        role: 'viewer',
      });
      selectedRef.current.forEach((cameraId) => reconnectCamera(cameraId));
    });
n    // helper to expose ice servers to ensurePeerConnection
    function getIceServers() {
      return iceServersRef.current || [];
    }


    socket.on('camera-status', ({ cameras }) => {
      dispatch({ type: 'SET_ONLINE_CAMERAS', payload: cameras });
    });

    socket.on('camera-offer', async ({ offer, cameraId }) => {
      if (!selectedRef.current.includes(cameraId)) return;

      const pc = ensurePeerConnection(peersRef, cameraId, socket, getIceServers);
      pc.ontrack = (event) => {
        streamByCameraRef.current.set(cameraId, event.streams[0]);
        const videoEl = videoElementsRef.current.get(cameraId);
        if (videoEl) {
          videoEl.srcObject = event.streams[0];
        }
        dispatch({
          type: 'SET_STREAM_STATE',
          payload: { cameraId, value: { streamActive: true, updatedAt: new Date().toISOString() } },
        });
        setStreamVersion((value) => value + 1);
      };

      if (pc.signalingState !== 'stable') {
        await pc.setLocalDescription({ type: 'rollback' }).catch(() => {});
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('camera-answer', {
        cameraId,
        viewerSocketId: socket.id,
        answer,
      });
    });

    socket.on('ice-candidate', async ({ cameraId, candidate, direction }) => {
      if (direction !== 'camera-to-viewer') return;
      const pc = peersRef.current.get(cameraId);
      if (!pc) return;
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('viewer-left', ({ cameraId }) => {
      const pc = peersRef.current.get(cameraId);
      if (pc) {
        pc.close();
        peersRef.current.delete(cameraId);
      }
      streamByCameraRef.current.delete(cameraId);
      dispatch({
        type: 'SET_STREAM_STATE',
        payload: { cameraId, value: { streamActive: false } },
      });
      setStreamVersion((value) => value + 1);
    });

    socket.on('motion-alert', (event) => {
      dispatch({
        type: 'SET_LAST_MOTION_ALERT',
        payload: { alert: event, cameraId: event.cameraId, motionActive: true },
      });
      window.setTimeout(() => {
        dispatch({
          type: 'SET_LAST_MOTION_ALERT',
          payload: { alert: event, cameraId: event.cameraId, motionActive: false },
        });
      }, 6000);
      onRealtimeUpdate?.();
    });

    socket.on('camera-recording-status', ({ cameraId, recordingActive, at }) => {
      dispatch({
        type: 'SET_STREAM_STATE',
        payload: { cameraId, value: { recordingActive, recordingUpdatedAt: at } },
      });
    });

    socket.on('recording-created', (recording) => {
      dispatch({ type: 'UPSERT_RECORDING', payload: recording });
      onRealtimeUpdate?.();
    });

    socket.on('recording-updated', (recording) => {
      dispatch({ type: 'UPSERT_RECORDING', payload: recording });
    });

    reconnectProbeRef.current = window.setInterval(() => {
      selectedRef.current.forEach((cameraId) => {
        const stream = streamByCameraRef.current.get(cameraId);
        const active = Boolean(stream?.active);
        if (!active) {
          reconnectCamera(cameraId);
        }
      });
    }, 6000);

    return () => {
      if (reconnectProbeRef.current) {
        clearInterval(reconnectProbeRef.current);
      }
      selectedRef.current.forEach((cameraId) => {
        socket.emit('leave-camera-view', { cameraId });
      });
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      streamByCameraRef.current.clear();
      socket.disconnect();
    };
  }, [dispatch, onRealtimeUpdate, reconnectCamera]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    const previous = new Set(previousSelectedRef.current);
    const next = new Set(selectedCameraIds);

    selectedCameraIds.forEach((cameraId) => {
      if (!previous.has(cameraId)) {
        reconnectCamera(cameraId);
      }
    });

    previous.forEach((cameraId) => {
      if (!next.has(cameraId)) {
        socket.emit('leave-camera-view', { cameraId });
        const pc = peersRef.current.get(cameraId);
        if (pc) pc.close();
        peersRef.current.delete(cameraId);
        streamByCameraRef.current.delete(cameraId);
        const videoEl = videoElementsRef.current.get(cameraId);
        if (videoEl) {
          videoEl.srcObject = null;
        }
      }
    });
    previousSelectedRef.current = selectedCameraIds;
  }, [selectedCameraIds, reconnectCamera]);

  function toggleMute() {
    setIsMuted((value) => !value);
  }

  const streamEntries = useMemo(() => {
    const entries = [];
    for (const [cameraId, mediaStream] of streamByCameraRef.current.entries()) {
      entries.push({ cameraId, mediaStream });
    }
    return entries;
  }, [streamVersion]);

  function bindVideoElement(cameraId, element) {
    if (!cameraId) return;
    if (!element) {
      videoElementsRef.current.delete(cameraId);
      return;
    }
    videoElementsRef.current.set(cameraId, element);
    const stream = streamByCameraRef.current.get(cameraId);
    if (stream) {
      element.srcObject = stream;
    }
  }

  function takeScreenshot(cameraId) {
    const element = videoElementsRef.current.get(cameraId);
    if (!element || !element.videoWidth || !element.videoHeight) return null;
    const canvas = document.createElement('canvas');
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  async function requestFullscreen(element) {
    if (!element) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await element.requestFullscreen();
  }

  return {
    streamEntries,
    onlineCameras: state.cameras.online,
    lastMotionAlert: state.alerts.lastMotionAlert,
    motionByCamera: state.alerts.motionByCamera,
    streamStateByCamera: state.streams.byCamera,
    isMuted,
    toggleMute,
    takeScreenshot,
    requestFullscreen,
    bindVideoElement,
  };
}
