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
  viewerCameraMap.set(socketId, cameraId);
}

export function getViewerCamera(socketId) {
  return viewerCameraMap.get(socketId) || null;
}

export function removeNode(socketId) {
  const node = nodes.get(socketId) || null;
  nodes.delete(socketId);
  const watchingCameraId = viewerCameraMap.get(socketId) || null;
  viewerCameraMap.delete(socketId);
  return { node, watchingCameraId };
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
