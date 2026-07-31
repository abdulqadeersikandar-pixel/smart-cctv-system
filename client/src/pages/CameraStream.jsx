import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, CircleDot, Dot, ShieldCheck, Video } from 'lucide-react';
import { createRealtimeConnection } from '../services/realtime';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default function CameraStream() {
  const [cameraName, setCameraName] = useState('Samsung J3 Pro - Front Door');
  const [cameraId, setCameraId] = useState('j3-front-door');
  const [sourceType, setSourceType] = useState('phone');
  const [motionDetected, setMotionDetected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [registrationError, setRegistrationError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const prevFrameRef = useRef(null);
  const motionResetTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(null);
  const isRecordingRef = useRef(false);

  const effectiveCameraId = useMemo(() => cameraId.trim() || 'camera-node', [cameraId]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      isRecordingRef.current = false;
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(
    async (trigger = 'manual', autoStopAfterMs = 0) => {
      if (!streamRef.current || isRecordingRef.current) return;
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp8',
      });

      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        isRecordingRef.current = false;
        setIsRecording(false);
        socketRef.current?.emit('camera-recording-status', {
          cameraId: effectiveCameraId,
          recordingActive: false,
          at: new Date().toISOString(),
        });
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType });
        const arrayBuffer = await blob.arrayBuffer();
        const base64Data = arrayBufferToBase64(arrayBuffer);
        const startedAt = recordingStartedAtRef.current || Date.now();
        const endedAt = Date.now();

        socketRef.current?.emit('recording-upload', {
          cameraId: effectiveCameraId,
          cameraName,
          trigger,
          mimeType: recorder.mimeType,
          base64Data,
          durationSeconds: Math.max(1, Math.round((endedAt - startedAt) / 1000)),
          createdAt: new Date(startedAt).toISOString(),
        });
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      isRecordingRef.current = true;
      setIsRecording(true);
      socketRef.current?.emit('camera-recording-status', {
        cameraId: effectiveCameraId,
        recordingActive: true,
        at: new Date().toISOString(),
      });

      if (autoStopAfterMs > 0) {
        window.setTimeout(stopRecording, autoStopAfterMs);
      }
    },
    [cameraName, effectiveCameraId, stopRecording]
  );

  const detectMotion = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    const width = 160;
    const height = 120;
    canvas.width = width;
    canvas.height = height;

    context.drawImage(video, 0, 0, width, height);
    const frameData = context.getImageData(0, 0, width, height).data;

    if (prevFrameRef.current) {
      let changedPixels = 0;
      for (let i = 0; i < frameData.length; i += 4) {
        const diff =
          Math.abs(frameData[i] - prevFrameRef.current[i]) +
          Math.abs(frameData[i + 1] - prevFrameRef.current[i + 1]) +
          Math.abs(frameData[i + 2] - prevFrameRef.current[i + 2]);
        if (diff > 90) changedPixels += 1;
      }

      const motionPercentage = (changedPixels / (width * height)) * 100;
      if (motionPercentage > 5) {
        setMotionDetected(true);
        if (motionResetTimerRef.current) {
          clearTimeout(motionResetTimerRef.current);
        }
        motionResetTimerRef.current = setTimeout(() => setMotionDetected(false), 1800);

        socketRef.current?.emit('motion-alert', {
          cameraId: effectiveCameraId,
          cameraName,
          screenshotDataUrl: canvas.toDataURL('image/jpeg', 0.7),
          createdAt: new Date().toISOString(),
        });

        if (!isRecordingRef.current) {
          startRecording('motion', 8000);
        }
      }
    }

    prevFrameRef.current = new Uint8ClampedArray(frameData);
  }, [cameraName, effectiveCameraId, startRecording]);

  useEffect(() => {
    const socket = createRealtimeConnection();
    socketRef.current = socket;
    const peers = peerConnectionsRef.current;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      setRegistrationError('');
      socket.emit('register', {
        id: effectiveCameraId,
        name: cameraName,
        role: 'camera',
        sourceType,
      });
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('reconnecting');
    });

    socket.on('camera-registration-denied', ({ message }) => {
      setRegistrationError(message || 'Camera registration denied by admin.');
      setConnectionStatus('denied');
      socket.disconnect();
    });

    const handleViewerJoined = async ({ viewerSocketId, cameraId: targetCameraId }) => {
      if (targetCameraId !== effectiveCameraId || !streamRef.current) return;

      const previous = peers.get(viewerSocketId);
      if (previous) {
        previous.close();
        peers.delete(viewerSocketId);
      }

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      peers.set(viewerSocketId, peer);

      streamRef.current.getTracks().forEach((track) => {
        peer.addTrack(track, streamRef.current);
      });

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        socket.emit('ice-candidate', {
          cameraId: effectiveCameraId,
          viewerSocketId,
          candidate: event.candidate,
          direction: 'camera-to-viewer',
        });
      };

      const offer = await peer.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await peer.setLocalDescription(offer);

      socket.emit('camera-offer', {
        cameraId: effectiveCameraId,
        viewerSocketId,
        offer,
      });
    };

    socket.on('viewer-joined', handleViewerJoined);
    socket.on('request-camera-offer', handleViewerJoined);

    socket.on('camera-answer', async ({ viewerSocketId, answer }) => {
      const peer = peers.get(viewerSocketId);
      if (!peer) return;
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async ({ viewerSocketId, candidate, direction }) => {
      if (direction !== 'viewer-to-camera') return;
      const peer = peers.get(viewerSocketId);
      if (!peer) return;
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('viewer-left', ({ viewerSocketId }) => {
      const peer = peers.get(viewerSocketId);
      if (peer) {
        peer.close();
        peers.delete(viewerSocketId);
      }
    });

    let motionIntervalId;
    const heartbeatId = window.setInterval(() => {
      if (!socket.connected) return;
      socket.emit('register', {
        id: effectiveCameraId,
        name: cameraName,
        role: 'camera',
        sourceType,
      });
    }, 20000);

    navigator.mediaDevices
      .getUserMedia({
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 24 },
  },
  audio: false,
})
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onplay = () => {
            motionIntervalId = window.setInterval(detectMotion, 300);
          };
        }
      })
      .catch((error) => {
        console.error('Camera access error:', error);
      });

    return () => {
      if (motionIntervalId) {
        clearInterval(motionIntervalId);
      }
      if (motionResetTimerRef.current) {
        clearTimeout(motionResetTimerRef.current);
      }
      clearInterval(heartbeatId);
      stopRecording();
      peers.forEach((peer) => peer.close());
      peers.clear();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      socket.disconnect();
    };
  }, [cameraName, detectMotion, effectiveCameraId, sourceType, stopRecording]);

  return (
    <div className="min-h-screen bg-dark-900 p-4 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="glass-panel mb-4 p-4">
          <h1 className="text-2xl font-bold text-primary-500">Camera Node Console</h1>
          <p className="mt-1 text-sm text-gray-400">
            Use this page on Samsung J3 Pro now; switch to USB/IP camera source later without dashboard changes.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Connection: <span className="font-semibold">{connectionStatus}</span>
            {registrationError ? ` · ${registrationError}` : ''}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              className="rounded-lg border border-dark-700 bg-dark-900/40 px-3 py-2 text-sm"
              value={cameraName}
              onChange={(event) => setCameraName(event.target.value)}
              placeholder="Camera Name"
            />
            <input
              className="rounded-lg border border-dark-700 bg-dark-900/40 px-3 py-2 text-sm"
              value={cameraId}
              onChange={(event) => setCameraId(event.target.value)}
              placeholder="Camera ID"
            />
            <select
              className="rounded-lg border border-dark-700 bg-dark-900/40 px-3 py-2 text-sm"
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
            >
              <option value="phone">Samsung/Phone</option>
              <option value="usb">USB Camera</option>
              <option value="ip">IP Camera</option>
            </select>
          </div>
        </div>

        <div className="glass-panel relative overflow-hidden p-3">
          <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg border border-dark-700 bg-black" />
          <canvas ref={canvasRef} className="hidden" />
          {motionDetected ? (
            <div className="absolute right-6 top-6 flex items-center gap-2 rounded-lg bg-red-600/90 px-3 py-2 text-sm font-semibold">
              <Activity size={16} />
              Motion Detected
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold hover:bg-primary-500"
            onClick={() => startRecording('manual')}
            disabled={isRecording}
          >
            <Video size={16} className="mr-1 inline" />
            Start Manual Recording
          </button>
          <button
            type="button"
            className="rounded-lg border border-dark-700 px-4 py-2 text-sm"
            onClick={stopRecording}
            disabled={!isRecording}
          >
            Stop Recording
          </button>
          <div className="flex items-center rounded-lg border border-dark-700 px-4 py-2 text-sm text-gray-300">
            <ShieldCheck size={16} className="mr-1 text-green-400" />
            Node Ready
            {isRecording ? <CircleDot size={16} className="ml-2 text-red-400" /> : <Dot size={16} className="ml-2 text-gray-500" />}
          </div>
        </div>
      </div>
    </div>
  );
}