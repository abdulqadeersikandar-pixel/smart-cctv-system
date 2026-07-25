import { store } from '../services/dataStore.js';
import { listOnlineCameras } from '../services/nodeRegistry.js';
import { getStorageUsageBytes } from '../services/fileStorage.js';

export async function getDashboardSummary(req, res) {
  const [cameras, events, recordings, storageUsedBytes] = await Promise.all([
    store.listCameras(),
    store.listEvents(10),
    store.listRecordings(10),
    getStorageUsageBytes(),
  ]);

  const onlineCameras = listOnlineCameras();
  const onlineIds = new Set(onlineCameras.map((camera) => camera.id));

  const summary = {
    onlineCameras: cameras.filter((camera) => onlineIds.has(camera.id)).length,
    offlineCameras: cameras.filter((camera) => !onlineIds.has(camera.id)).length,
    motionAlerts: events.filter((event) => event.type === 'motion').length,
    recordings: recordings.length,
    storageUsedBytes,
    systemStatus: onlineCameras.length > 0 ? 'active' : 'idle',
  };

  res.json({
    summary,
    recentEvents: events,
    recentRecordings: recordings,
  });
}
