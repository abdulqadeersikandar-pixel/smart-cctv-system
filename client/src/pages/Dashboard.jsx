import { useMemo, useState } from 'react';
import {
  Bell,
  Camera,
  Download,
  Expand,
  Grid2x2,
  List,
  LogOut,
  MicOff,
  RefreshCcw,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/dashboard/StatCard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useViewerStream } from '../hooks/useViewerStream';
import { useAuth } from '../hooks/useAuth';
import { useAppState } from '../hooks/useAppState';
import { apiClient } from '../services/apiClient';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatTime(value) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();
  const { state, dispatch } = useAppState();
  const {
    summary,
    cameras,
    events,
    recordings,
    loading,
    error,
    refresh,
    addCamera,
    updateCamera,
    removeCamera,
    removeRecording,
  } = useDashboardData();

  const selectedCameraIds = state.cameras.selectedIds;
  const focusCameraId = state.cameras.focusId;
  const viewMode = state.streams.viewMode;

  const [newCameraName, setNewCameraName] = useState('');
  const [newCameraType, setNewCameraType] = useState('phone');
  const [newCameraSourceUrl, setNewCameraSourceUrl] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState('');

  const {
    onlineCameras,
    lastMotionAlert,
    motionByCamera,
    streamStateByCamera,
    isMuted,
    toggleMute,
    takeScreenshot,
    requestFullscreen,
    bindVideoElement,
  } = useViewerStream(selectedCameraIds, refresh);

  const onlineCameraIds = useMemo(() => new Set(onlineCameras.map((camera) => camera.id)), [onlineCameras]);

  const effectiveSummary = useMemo(
    () => ({
      onlineCameras: summary?.onlineCameras || 0,
      offlineCameras: summary?.offlineCameras || 0,
      motionAlerts: summary?.motionAlerts || 0,
      recordings: summary?.recordings || 0,
      cloudSyncedRecordings: summary?.cloudSyncedRecordings || 0,
      pendingCloudUploads: summary?.pendingCloudUploads || 0,
      storageUsedBytes: summary?.storageUsedBytes || 0,
      systemStatus: summary?.systemStatus || 'idle',
    }),
    [summary]
  );

  const camerasToRender =
    viewMode === 'single'
      ? cameras.filter((camera) => camera.id === focusCameraId)
      : cameras.filter((camera) => selectedCameraIds.includes(camera.id));

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  async function handleCreateCamera(event) {
    event.preventDefault();
    await addCamera({
      name: newCameraName,
      sourceType: newCameraType,
      sourceUrl: newCameraSourceUrl,
    });
    setNewCameraName('');
    setNewCameraSourceUrl('');
  }

  async function handleRenameCamera(cameraId, currentName) {
    const nextName = window.prompt('Rename camera', currentName);
    if (!nextName || nextName.trim() === currentName) return;
    await updateCamera(cameraId, { name: nextName.trim() });
  }

  async function handleDeleteCamera(cameraId) {
    const confirmed = window.confirm('Delete this camera from management list?');
    if (!confirmed) return;
    await removeCamera(cameraId);
  }

  function toggleCameraSelection(cameraId) {
    const exists = selectedCameraIds.includes(cameraId);
    const next = exists ? selectedCameraIds.filter((id) => id !== cameraId) : [...selectedCameraIds, cameraId];
    dispatch({ type: 'SET_SELECTED_CAMERAS', payload: next });
    if (!focusCameraId && next.length > 0) {
      dispatch({ type: 'SET_FOCUS_CAMERA', payload: next[0] });
    }
  }

  function onCameraFocus(cameraId) {
    dispatch({ type: 'SET_FOCUS_CAMERA', payload: cameraId });
    if (!selectedCameraIds.includes(cameraId)) {
      dispatch({ type: 'SET_SELECTED_CAMERAS', payload: [cameraId] });
    }
  }

  function handleScreenshot(cameraId) {
    const image = takeScreenshot(cameraId);
    if (image) {
      setScreenshotPreview(image);
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 text-gray-100">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <header className="glass-panel mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Smart CCTV Command Center</h1>
            <p className="text-sm text-gray-400">Production dashboard with multi-camera monitoring and cloud sync.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={refresh} className="rounded-lg border border-dark-700 px-3 py-2 text-sm hover:border-primary-500">
              <RefreshCcw size={16} className="mr-2 inline" />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-red-500/50 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
            >
              <LogOut size={16} className="mr-2 inline" />
              Logout
            </button>
          </div>
        </header>

        {error ? <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-8">
          <StatCard label="Online Cameras" value={effectiveSummary.onlineCameras} hint="Live now" />
          <StatCard label="Offline Cameras" value={effectiveSummary.offlineCameras} hint="Need attention" />
          <StatCard label="Motion Alerts" value={effectiveSummary.motionAlerts} hint="Recent incidents" />
          <StatCard label="Recordings" value={effectiveSummary.recordings} hint="Saved clips" />
          <StatCard label="Cloud Synced" value={effectiveSummary.cloudSyncedRecordings} hint="Drive uploaded" />
          <StatCard label="Pending Uploads" value={effectiveSummary.pendingCloudUploads} hint="Sync queue" />
          <StatCard label="Storage Usage" value={formatBytes(effectiveSummary.storageUsedBytes)} hint="Local storage" />
          <StatCard label="System Status" value={effectiveSummary.systemStatus} hint={loading ? 'Syncing...' : 'Operational'} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="glass-panel p-4 xl:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Live Streaming</h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'single' })}
                  className={`rounded-lg border px-3 py-2 text-sm ${viewMode === 'single' ? 'border-primary-500' : 'border-dark-700'}`}
                >
                  <List size={14} className="mr-1 inline" />
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'grid' })}
                  className={`rounded-lg border px-3 py-2 text-sm ${viewMode === 'grid' ? 'border-primary-500' : 'border-dark-700'}`}
                >
                  <Grid2x2 size={14} className="mr-1 inline" />
                  Grid
                </button>
                <button type="button" onClick={toggleMute} className="rounded-lg border border-dark-700 px-3 py-2 text-sm">
                  {isMuted ? <Volume2 size={16} className="mr-1 inline" /> : <MicOff size={16} className="mr-1 inline" />}
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
              </div>
            </div>

            <div className={`grid gap-4 ${viewMode === 'single' ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
              {camerasToRender.length === 0 ? (
                <div className="flex h-56 items-center justify-center rounded-lg border border-dark-700 bg-black/40 text-sm text-gray-500">
                  Select camera(s) from Camera Management to start stream.
                </div>
              ) : null}
              {camerasToRender.map((camera) => {
                const streamState = streamStateByCamera[camera.id] || {};
                return (
                  <div key={camera.id} className="stream-card rounded-lg border border-dark-700 bg-black/30">
                    <div className="flex items-center justify-between border-b border-dark-700 p-3 text-sm">
                      <span className="font-semibold">{camera.name}</span>
                      <span className={onlineCameraIds.has(camera.id) ? 'text-green-400' : 'text-gray-500'}>
                        {onlineCameraIds.has(camera.id) ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div className="relative aspect-video overflow-hidden">
                      <video
                        ref={(element) => bindVideoElement(camera.id, element)}
                        autoPlay
                        playsInline
                        muted={isMuted}
                        className="h-full w-full object-cover"
                      />
                      {!streamState.streamActive ? (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                          Waiting for stream...
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 p-3 text-xs text-gray-300">
                      <span>Last seen: {formatTime(camera.lastSeenAt)}</span>
                      <span>• Motion: {motionByCamera[camera.id] ? 'Active' : 'Idle'}</span>
                      <span>• Recording: {streamState.recordingActive ? 'ON' : 'OFF'}</span>
                      <button
                        type="button"
                        className="ml-auto rounded border border-dark-700 px-2 py-1"
                        onClick={(event) => {
                          const card = event.currentTarget.closest('.stream-card');
                          const videoElement = card?.querySelector('video');
                          requestFullscreen(videoElement);
                        }}
                      >
                        <Expand size={12} className="mr-1 inline" />
                        Fullscreen
                      </button>
                      <button
                        type="button"
                        className="rounded border border-dark-700 px-2 py-1"
                        onClick={() => handleScreenshot(camera.id)}
                      >
                        Screenshot
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {screenshotPreview ? (
              <div className="mt-3">
                <p className="mb-1 text-xs text-gray-400">Latest Screenshot</p>
                <img alt="Latest camera screenshot" src={screenshotPreview} className="max-h-40 rounded-lg border border-dark-700" />
              </div>
            ) : null}
          </section>

          <section className="glass-panel p-4">
            <div className="mb-3 flex items-center gap-2">
              <Bell size={18} />
              <h2 className="text-lg font-semibold">Motion Alerts</h2>
            </div>
            {lastMotionAlert ? (
              <div className="mb-3 rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-sm">
                <p className="font-medium">{lastMotionAlert.cameraName}</p>
                <p>{lastMotionAlert.message}</p>
                <p className="mt-1 text-xs text-gray-300">{new Date(lastMotionAlert.createdAt).toLocaleString()}</p>
              </div>
            ) : null}
            <div className="max-h-80 space-y-2 overflow-auto">
              {events.map((event) => (
                <div key={event.id} className="rounded-lg border border-dark-700 p-3 text-sm">
                  <p className="font-medium">{event.cameraName}</p>
                  <p className="text-gray-300">{event.message}</p>
                  <p className="text-xs text-gray-500">{new Date(event.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="glass-panel p-4">
            <h2 className="mb-3 text-lg font-semibold">Camera Management</h2>
            <form className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-4" onSubmit={handleCreateCamera}>
              <input
                className="rounded-lg border border-dark-700 bg-dark-900/40 px-3 py-2 text-sm"
                placeholder="Camera name"
                value={newCameraName}
                onChange={(event) => setNewCameraName(event.target.value)}
                required
              />
              <select
                className="rounded-lg border border-dark-700 bg-dark-900/40 px-3 py-2 text-sm"
                value={newCameraType}
                onChange={(event) => setNewCameraType(event.target.value)}
              >
                <option value="phone">Samsung/Phone</option>
                <option value="usb">USB Camera</option>
                <option value="ip">IP Camera</option>
              </select>
              <input
                className="rounded-lg border border-dark-700 bg-dark-900/40 px-3 py-2 text-sm"
                placeholder="Source URL (optional)"
                value={newCameraSourceUrl}
                onChange={(event) => setNewCameraSourceUrl(event.target.value)}
              />
              <button className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold hover:bg-primary-500" type="submit">
                Add Camera
              </button>
            </form>

            <div className="space-y-2">
              {cameras.map((camera) => {
                const streamState = streamStateByCamera[camera.id] || {};
                return (
                  <div key={camera.id} className="rounded-lg border border-dark-700 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Camera size={16} />
                        <div>
                          <p className="text-sm font-medium">{camera.name}</p>
                          <p className="text-xs text-gray-500">
                            {camera.sourceType.toUpperCase()} · {onlineCameraIds.has(camera.id) ? 'Online' : 'Offline'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" className="rounded border border-dark-700 px-2 py-1 text-xs" onClick={() => handleRenameCamera(camera.id, camera.name)}>
                          Rename
                        </button>
                        <button
                          type="button"
                          className="rounded border border-red-500/50 px-2 py-1 text-xs text-red-300"
                          onClick={() => handleDeleteCamera(camera.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <label className="flex items-center gap-1 rounded border border-dark-700 px-2 py-1">
                        <input
                          type="checkbox"
                          checked={selectedCameraIds.includes(camera.id)}
                          onChange={() => toggleCameraSelection(camera.id)}
                        />
                        Include
                      </label>
                      <button type="button" className="rounded border border-dark-700 px-2 py-1" onClick={() => onCameraFocus(camera.id)}>
                        Focus
                      </button>
                      <span className="text-gray-400">Last seen: {formatTime(camera.lastSeenAt)}</span>
                      <span className="text-gray-400">Recording: {streamState.recordingActive ? 'ON' : 'OFF'}</span>
                      <span className="text-gray-400">Motion: {motionByCamera[camera.id] ? 'Active' : 'Idle'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="glass-panel p-4">
            <h2 className="mb-3 text-lg font-semibold">Recordings</h2>
            <div className="max-h-[420px] space-y-2 overflow-auto">
              {recordings.map((recording) => (
                <div key={recording.id} className="rounded-lg border border-dark-700 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{recording.cameraName}</p>
                      <p className="text-xs text-gray-400">
                        {recording.trigger.toUpperCase()} · {new Date(recording.createdAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">{formatBytes(recording.sizeBytes)}</p>
                      <p className="text-xs text-gray-500">Cloud: {recording.uploadStatus || 'local_only'}</p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        className="rounded border border-dark-700 px-2 py-1 text-xs hover:border-primary-500"
                        href={apiClient.getRecordingDownloadUrl(recording.id, 'auto')}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download size={12} className="mr-1 inline" />
                        Download
                      </a>
                      <button
                        type="button"
                        className="rounded border border-red-500/50 px-2 py-1 text-xs text-red-300"
                        onClick={() => removeRecording(recording.id)}
                      >
                        <Trash2 size={12} className="mr-1 inline" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="mt-6 text-xs text-gray-500">
          Logged in as {currentUser?.email || 'N/A'}
        </footer>
      </div>
    </div>
  );
}
