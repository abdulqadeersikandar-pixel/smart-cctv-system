import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { useAppState } from './useAppState';

export function useDashboardData() {
  const { state, dispatch } = useAppState();
  const [refreshTick, setRefreshTick] = useState(0);

  const load = useCallback(async () => {
    dispatch({ type: 'DASHBOARD_LOADING', payload: true });
    dispatch({ type: 'DASHBOARD_ERROR', payload: '' });
    try {
      const [summaryRes, camerasRes, eventsRes, recordingsRes] = await Promise.all([
        apiClient.getDashboardSummary(),
        apiClient.listCameras(),
        apiClient.listEvents(),
        apiClient.listRecordings(),
      ]);
      dispatch({
        type: 'SET_DASHBOARD_DATA',
        payload: {
          summary: summaryRes.summary,
          cameras: camerasRes.cameras,
          events: eventsRes.events,
          recordings: recordingsRes.recordings,
        },
      });
    } catch (fetchError) {
      dispatch({ type: 'DASHBOARD_ERROR', payload: fetchError.message });
      dispatch({ type: 'DASHBOARD_LOADING', payload: false });
    }
  }, [dispatch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, refreshTick]);

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

  const refresh = useCallback(() => {
    setRefreshTick((value) => value + 1);
  }, []);

  return {
    summary: state.dashboard.summary,
    cameras: state.cameras.items,
    events: state.alerts.events,
    recordings: state.recordings.items,
    loading: state.dashboard.loading,
    error: state.dashboard.error,
    refresh,
    addCamera,
    updateCamera,
    removeCamera,
    removeRecording,
  };
}
