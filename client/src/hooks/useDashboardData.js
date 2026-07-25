import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';

export function useDashboardData() {
  const [summary, setSummary] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [events, setEvents] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, camerasRes, eventsRes, recordingsRes] = await Promise.all([
        apiClient.getDashboardSummary(),
        apiClient.listCameras(),
        apiClient.listEvents(),
        apiClient.listRecordings(),
      ]);
      setSummary(summaryRes.summary);
      setCameras(camerasRes.cameras);
      setEvents(eventsRes.events);
      setRecordings(recordingsRes.recordings);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const addCamera = useCallback(async (payload) => {
    await apiClient.addCamera(payload);
    await load();
  }, [load]);

  const updateCamera = useCallback(async (cameraId, payload) => {
    await apiClient.renameCamera(cameraId, payload);
    await load();
  }, [load]);

  const removeCamera = useCallback(async (cameraId) => {
    await apiClient.removeCamera(cameraId);
    await load();
  }, [load]);

  const removeRecording = useCallback(async (recordingId) => {
    await apiClient.deleteRecording(recordingId);
    await load();
  }, [load]);

  return {
    summary,
    cameras,
    events,
    recordings,
    loading,
    error,
    refresh: load,
    addCamera,
    updateCamera,
    removeCamera,
    removeRecording,
  };
}
