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
  removeViewerCamera,
  getCameraSocketIds,
} from './services/nodeRegistry.js';
import { env } from './config/env.js';
import { store } from './services/dataStore.js';
import { resolveStorageAbsolutePath, saveDataUrlImage, saveBase64Video } from './services/fileStorage.js';
import { HttpError } from './utils/httpError.js';
import { isDriveSyncEnabled, uploadRecordingFileToDrive } from './services/driveStorage.js';
import { fileExistsInStorage, runRetentionSweepWithEventLog } from './services/recordingRetention.js';

await store.initialize();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret'],
  },
});

// Admin and helper endpoints (protected with ADMIN_SECRET header if set)
app.get('/api/webrtc/config', (req, res) => {
  const config = { iceServers: env.iceServers || [] };
  res.json(config);
});

app.post('/api/admin/sync-pending', async (req, res) => {
  const adminHeader = req.headers['x-admin-secret'] || '';
  if (env.adminSecret && adminHeader !== env.adminSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    await syncPendingRecordingsToDrive();
    return res.json({ ok: true, message: 'Sync started' });
  } catch (error) {
    console.error('Manual sync failed:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/admin/run-retention', async (req, res) => {
  const adminHeader = req.headers['x-admin-secret'] || '';
  if (env.adminSecret && adminHeader !== env.adminSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    await runRetentionSweepWithEventLog();
    return res.json({ ok: true, message: 'Retention sweep executed' });
  } catch (error) {
    console.error('Manual retention sweep failed:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

function broadcastCameraStatus() {
  io.emit('camera-status', { cameras: listOnlineCameras() });
}

async function archiveRecordingToDrive(recording) {
  if (!isDriveSyncEnabled()) {
    const localOnly = await store.updateRecording(recording.id, {
      uploadStatus: 'local_only',
      uploadError: '',
    });
    io.emit('recording-updated', localOnly);
    return;
  }
  const exists = await fileExistsInStorage(recording.filePath);
  if (!exists) {
    const missing = await store.updateRecording(recording.id, {
      uploadStatus: 'failed',
      uploadError: 'Local recording file is missing before cloud sync.',
    });
    io.emit('recording-updated', missing);
    return;
  }

  const uploading = await store.updateRecording(recording.id, {
    uploadStatus: 'uploading',
    uploadError: '',
  });
  io.emit('recording-updated', uploading);

  const absolutePath = resolveStorageAbsolutePath(recording.filePath);
  const uploaded = await uploadRecordingFileToDrive(absolutePath, {
    cameraId: recording.cameraId,
    createdAt: recording.createdAt,
    fileName: recording.originalFileName || `${recording.cameraId}-${new Date(recording.createdAt).toISOString()}.webm`,
  });
  if (!uploaded) return;

  const updated = await store.updateRecording(recording.id, {
    driveFileId: uploaded.driveFileId,
    driveLink: uploaded.driveLink,
    driveDownloadLink: uploaded.driveDownloadLink,
    drivePath: uploaded.drivePath,
    uploadStatus: 'uploaded',
    uploadError: '',
    uploadedAt: new Date().toISOString(),
  });
  io.emit('recording-updated', updated);
}

async function syncPendingRecordingsToDrive() {
  if (!isDriveSyncEnabled()) return;
  const allRecordings = await store.listRecordings(0);
  const candidates = allRecordings.filter((recording) => {
    if (!recording.filePath) return false;
    if (recording.driveFileId) return false;
    return ['pending', 'failed', 'uploading'].includes(recording.uploadStatus || 'pending');
  });

  for (const recording of candidates) {
    try {
      await archiveRecordingToDrive(recording);
    } catch (error) {
      const failed = await store.updateRecording(recording.id, {
        uploadStatus: 'failed',
        uploadError: error.message || 'Drive upload failed.',
      });
      io.emit('recording-updated', failed);
    }
  }
}

setInterval(() => {
  runRetentionSweepWithEventLog().catch((error) => {
    console.error('Retention sweep failed:', error);
  });
}, Math.max(5, env.retentionSweepIntervalMinutes) * 60 * 1000);

syncPendingRecordingsToDrive().catch((error) => {
  console.error('Initial recording sync failed:', error);
});

io.on('connection', (socket) => {
  console.log(`🟢 Node Connected: ${socket.id}`);

  socket.on('register', async ({ id, name, role, sourceType } = {}) => {
    try {
      const node = registerNode(socket.id, { id, name, role, sourceType });
      console.log(`📋 Registered: ${node.role} "${node.name}" (${node.id})`);

      if (node.role === 'camera') {
        const isAuthorized = await store.isCameraAuthorized(node.id);
        if (!isAuthorized) {
          socket.emit('camera-registration-denied', {
            cameraId: node.id,
            message: 'Camera is not approved by admin.',
          });
          removeNode(socket.id);
          return;
        }

        socket.join(`camera:${node.id}`);
        await store.markCameraOnline(node.id, node.name, node.sourceType);
        broadcastCameraStatus();
      } else {
        socket.emit('camera-status', { cameras: listOnlineCameras() });
      }
    } catch (error) {
      console.error('Failed to register node:', error);
    }
  });

  socket.on('join-camera-view', ({ cameraId } = {}) => {
    if (!cameraId) return;
    setViewerCamera(socket.id, cameraId);
    const payload = {
      viewerSocketId: socket.id,
      cameraId,
    };
    io.to(`camera:${cameraId}`).emit('viewer-joined', payload);
    io.to(`camera:${cameraId}`).emit('request-camera-offer', payload);
  });

  socket.on('leave-camera-view', ({ cameraId } = {}) => {
    if (!cameraId) return;
    removeViewerCamera(socket.id, cameraId);
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

  socket.on('request-camera-offer', ({ cameraId, viewerSocketId } = {}) => {
    if (!cameraId || !viewerSocketId) return;
    io.to(`camera:${cameraId}`).emit('request-camera-offer', {
      cameraId,
      viewerSocketId,
    });
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
      io.emit('camera-motion-status', {
        cameraId,
        motionActive: true,
        at: createdAt,
      });
    } catch (error) {
      console.error('Failed to process motion alert:', error);
    }
  });

  socket.on('camera-recording-status', ({ cameraId, recordingActive, at } = {}) => {
    if (!cameraId || typeof recordingActive !== 'boolean') return;
    io.emit('camera-recording-status', {
      cameraId,
      recordingActive,
      at: at || new Date().toISOString(),
    });
  });

  socket.on('recording-upload', async (payload = {}) => {
    try {
      if (!payload.cameraId || !payload.cameraName || !payload.base64Data) {
        throw new HttpError(400, 'Invalid recording payload.');
      }

      const createdAt = payload.createdAt || new Date().toISOString();
      const { filePath, sizeBytes, originalFileName } = await saveBase64Video(
        payload.base64Data,
        payload.mimeType || 'video/webm',
        payload.cameraId,
        createdAt
      );

      const recording = await store.createRecording({
        cameraId: payload.cameraId,
        cameraName: payload.cameraName,
        trigger: payload.trigger || 'manual',
        filePath,
        originalFileName,
        mimeType: payload.mimeType || 'video/webm',
        sizeBytes,
        durationSeconds: payload.durationSeconds || 0,
        createdAt,
        uploadStatus: isDriveSyncEnabled() ? 'pending' : 'local_only',
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

      archiveRecordingToDrive(recording).catch(async (error) => {
        console.error('Failed to archive recording to Drive:', error);
        const failed = await store.updateRecording(recording.id, {
          uploadStatus: 'failed',
          uploadError: error.message || 'Drive upload failed.',
        });
        io.emit('recording-updated', failed);
      });

      runRetentionSweepWithEventLog().catch((error) => {
        console.error('Retention cleanup failed after recording upload:', error);
      });
    } catch (error) {
      console.error('Failed to save recording upload:', error);
    }
  });

  socket.on('disconnect', async () => {
    const { node, watchingCameraIds } = removeNode(socket.id);
    console.log(`🔴 Node Disconnected: ${socket.id}${node ? ` (${node.role} "${node.name}")` : ''}`);

    for (const watchingCameraId of watchingCameraIds) {
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

