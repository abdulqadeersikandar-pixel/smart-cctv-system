const nodes = new Map();
const viewerCameraMap = new Map();

export function registerNode(socketId, { id, name, role, sourceType }) {
  const node = {
    id: id || socketId,
    name: name || 'Unnamed Node',
    role: role || 'unknown',
    sourceType: sourceType || 'phone',
    connectedAt: new Date().toISOString(),
  };
  nodes.set(socketId, node);
  return node;
}

export function setViewerCamera(socketId, cameraId) {
  const watched = viewerCameraMap.get(socketId) || new Set();
  watched.add(cameraId);
  viewerCameraMap.set(socketId, watched);
}

export function getViewerCamera(socketId) {
  const watched = viewerCameraMap.get(socketId) || new Set();
  return Array.from(watched);
}

export function removeViewerCamera(socketId, cameraId) {
  const watched = viewerCameraMap.get(socketId);
  if (!watched) return;
  watched.delete(cameraId);
  if (watched.size === 0) {
    viewerCameraMap.delete(socketId);
  }
}

export function removeNode(socketId) {
  const node = nodes.get(socketId) || null;
  nodes.delete(socketId);
  const watchingCameraIds = Array.from(viewerCameraMap.get(socketId) || []);
  viewerCameraMap.delete(socketId);
  return { node, watchingCameraIds };
}

export function listOnlineCameras() {
  return Array.from(nodes.entries())
    .filter(([, node]) => node.role === 'camera')
    .map(([socketId, node]) => ({ ...node, socketId }));
}

export function getCameraSocketIds(cameraId) {
  return Array.from(nodes.entries())
    .filter(([, node]) => node.role === 'camera' && node.id === cameraId)
    .map(([socketId]) => socketId);
}

export function getSnapshot() {
  return Array.from(nodes.entries()).map(([socketId, node]) => ({ socketId, ...node }));
}
