import { store } from '../services/dataStore.js';
import { listOnlineCameras } from '../services/nodeRegistry.js';

function cameraIds(onlineCameras) {
  return new Set(onlineCameras.map((camera) => camera.id));
}

export async function listCameras(req, res) {
  const [storedCameras, online] = await Promise.all([store.listCameras(), listOnlineCameras()]);
  const onlineIds = cameraIds(online);

  const merged = storedCameras.map((camera) => {
    if (!onlineIds.has(camera.id)) return camera;
    return {
      ...camera,
      status: 'online',
      health: 'healthy',
    };
  });

  res.json({ cameras: merged });
}

export async function createCamera(req, res) {
  const camera = await store.createCamera(req.body);
  res.status(201).json({ camera });
}

export async function updateCamera(req, res) {
  const camera = await store.updateCamera(req.params.cameraId, req.body);
  res.json({ camera });
}

export async function deleteCamera(req, res) {
  await store.deleteCamera(req.params.cameraId);
  res.status(204).send();
}
