import { createServer } from 'http';
import { Server } from 'socket.io';
import { app, allowedOrigins } from './app.js';
import {
  registerNode,
  removeNode,
  listOnlineCameras,
  getSnapshot,
  setViewerCamera,
  getViewerCamera,
  getCameraSocketIds,
} from './services/nodeRegistry.js';
import { env } from './config/env.js';
import { store } from './services/dataStore.js';
import { saveDataUrlImage, saveBase64Video } from './services/fileStorage.js';
import { HttpError } from './utils/httpError.js';

await store.initialize();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

function broadcastCameraStatus() {
  io.emit('camera-status', { cameras: listOnlineCameras() });
}

io.on('connection', (socket) => {
  console.log(`🟢 Node Connected: ${socket.id}`);

  socket.on('register', async ({ id, name, role, sourceType } = {}) => {
    const node = registerNode(socket.id, { id, name, role, sourceType });
    console.log(`📋 Registered: ${node.role} "${node.name}" (${node.id})`);

    if (node.role === 'camera') {
      socket.join(`camera:${node.id}`);
      await store.markCameraOnline(node.id, node.name, node.sourceType);
      broadcastCameraStatus();
    } else {
      socket.emit('camera-status', { cameras: listOnlineCameras() });
    }
  });

  socket.on('join-camera-view', ({ cameraId } = {}) => {
    if (!cameraId) return;
    const current = getViewerCamera(socket.id);
    if (current && current !== cameraId) {
      io.to(`camera:${current}`).emit('viewer-left', { viewerSocketId: socket.id, cameraId: current });
    }
    setViewerCamera(socket.id, cameraId);
    io.to(`camera:${cameraId}`).emit('viewer-joined', {
      viewerSocketId: socket.id,
      cameraId,
    });
  });

  socket.on('leave-camera-view', ({ cameraId } = {}) => {
    if (!cameraId) return;
    io.to(`camera:${cameraId}`).emit('viewer-left', { viewerSocketId: socket.id, cameraId });
  });

  socket.on('camera-offer', ({ cameraId, viewerSocketId, offer } = {}) => {
    if (!cameraId || !viewerSocketId || !offer) return;
    io.to(viewerSocketId).emit('camera-offer', { cameraId, viewerSocketId, offer });
  });

  socket.on('camera-answer', ({ cameraId, viewerSocketId, answer } = {}) => {
    if (!cameraId || !viewerSocketId || !answer) return;
    io.to(`camera:${cameraId}`).emit('camera-answer', { viewerSocketId, answer });
  });

  socket.on('ice-candidate', ({ cameraId, viewerSocketId, candidate, direction } = {}) => {
    if (!cameraId || !viewerSocketId || !candidate || !direction) return;
    if (direction === 'camera-to-viewer') {
      io.to(viewerSocketId).emit('ice-candidate', { cameraId, viewerSocketId, candidate, direction });
      return;
    }
    io.to(`camera:${cameraId}`).emit('ice-candidate', { cameraId, viewerSocketId, candidate, direction });
  });

  socket.on('motion-alert', async (alert = {}) => {
    try {
      const createdAt = new Date().toISOString();
      const cameraId = alert.cameraId || alert.node || 'unknown-camera';
      const cameraName = alert.cameraName || alert.node || 'Unknown Camera';

      let screenshotPath = '';
      if (alert.screenshotDataUrl) {
        screenshotPath = await saveDataUrlImage(alert.screenshotDataUrl, cameraId);
      }

      const event = await store.createEvent({
        type: 'motion',
        cameraId,
        cameraName,
        message: 'Motion detected',
        screenshotPath,
        createdAt,
        severity: 'critical',
      });

      io.emit('motion-alert', event);
    } catch (error) {
      console.error('Failed to process motion alert:', error);
    }
  });

  socket.on('recording-upload', async (payload = {}) => {
    try {
      if (!payload.cameraId || !payload.cameraName || !payload.base64Data) {
        throw new HttpError(400, 'Invalid recording payload.');
      }

      const { filePath, sizeBytes } = await saveBase64Video(
        payload.base64Data,
        payload.mimeType || 'video/webm',
        payload.cameraId
      );

      const recording = await store.createRecording({
        cameraId: payload.cameraId,
        cameraName: payload.cameraName,
        trigger: payload.trigger || 'manual',
        filePath,
        sizeBytes,
        durationSeconds: payload.durationSeconds || 0,
        createdAt: payload.createdAt || new Date().toISOString(),
      });

      await store.createEvent({
        type: 'system',
        cameraId: payload.cameraId,
        cameraName: payload.cameraName,
        message: `Recording saved (${recording.trigger})`,
        videoPath: recording.filePath,
        createdAt: recording.createdAt,
      });

      io.emit('recording-created', recording);
    } catch (error) {
      console.error('Failed to save recording upload:', error);
    }
  });

  socket.on('disconnect', async () => {
    const { node, watchingCameraId } = removeNode(socket.id);
    console.log(`🔴 Node Disconnected: ${socket.id}${node ? ` (${node.role} "${node.name}")` : ''}`);

    if (watchingCameraId) {
      io.to(`camera:${watchingCameraId}`).emit('viewer-left', {
        viewerSocketId: socket.id,
        cameraId: watchingCameraId,
      });
    }

    if (node?.role === 'camera') {
      await store.markCameraOffline(node.id);
      broadcastCameraStatus();
    }
  });
});

app.get('/api/nodes', (req, res) => {
  res.json({ nodes: getSnapshot() });
});

app.get('/api/stream/routes/:cameraId', (req, res) => {
  const sockets = getCameraSocketIds(req.params.cameraId);
  res.json({ cameraId: req.params.cameraId, cameraSocketCount: sockets.length });
});

const PORT = env.port;

httpServer.listen(PORT, () => {
  console.log(`🚀 Cloud Backend is running on http://localhost:${PORT}`);
});
