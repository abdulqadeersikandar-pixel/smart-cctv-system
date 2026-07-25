import { useMemo, useState } from 'react';
import {
  Bell,
  Camera,
  Download,
  Expand,
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
import { env } from '../config/env';

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

export default function Dashboard() {
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();
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

  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [newCameraName, setNewCameraName] = useState('');
  const [newCameraType, setNewCameraType] = useState('phone');
  const [newCameraSourceUrl, setNewCameraSourceUrl] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState('');

  const {
    videoRef,
    streamActive,
    isMuted,
    onlineCameras,
    lastMotionAlert,
    toggleMute,
    takeScreenshot,
    toggleFullscreen,
  } = useViewerStream(selectedCameraId, refresh);

  const onlineCameraIds = useMemo(
    () => new Set(onlineCameras.map((camera) => camera.id)),
    [onlineCameras]
  );

  const effectiveSummary = useMemo(
    () => ({
      onlineCameras: summary?.onlineCameras || 0,
      offlineCameras: summary?.offlineCameras || 0,
      motionAlerts: summary?.motionAlerts || 0,
      recordings: summary?.recordings || 0,
      storageUsedBytes: summary?.storageUsedBytes || 0,
      systemStatus: summary?.systemStatus || 'idle',
    }),
    [summary]
  );

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
    if (selectedCameraId === cameraId) {
      setSelectedCameraId('');
    }
  }

  function handleScreenshot() {
    const shot = takeScreenshot();
    if (shot) {
      setScreenshotPreview(shot);
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 text-gray-100">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <header className="glass-panel mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Smart CCTV Command Center</h1>
            <p className="text-sm text-gray-400">
              Monitor cameras, alerts, recordings, and health from anywhere.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg border border-dark-700 px-3 py-2 text-sm hover:border-primary-500"
            >
              <RefreshCcw size={16} className="inline mr-2" />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-red-500/50 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
            >
              <LogOut size={16} className="inline mr-2" />
              Logout
            </button>
          </div>
        </header>

        {error ? (
          <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Online Cameras" value={effectiveSummary.onlineCameras} hint="Live now" />
          <StatCard label="Offline Cameras" value={effectiveSummary.offlineCameras} hint="Need attention" />
          <StatCard label="Motion Alerts" value={effectiveSummary.motionAlerts} hint="Recent incidents" />
          <StatCard label="Recordings" value={effectiveSummary.recordings} hint="Saved clips" />
          <StatCard label="Storage Usage" value={formatBytes(effectiveSummary.storageUsedBytes)} hint="Local / cloud files" />
          <StatCard label="System Status" value={effectiveSummary.systemStatus} hint={loading ? 'Syncing...' : 'Operational'} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="glass-panel p-4 xl:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Live Streaming</h2>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-lg border border-dark-700 bg-dark-900/40 px-3 py-2 text-sm"
                  value={selectedCameraId}
                  onChange={(event) => setSelectedCameraId(event.target.value)}
                >
                  <option value="">Select Camera</option>
                  {cameras.map((camera) => (
                    <option key={camera.id} value={camera.id}>
                      {camera.name} ({onlineCameraIds.has(camera.id) ? 'Online' : 'Offline'})
                    </option>
                  ))}
                </select>
                <button type="button" onClick={toggleMute} className="rounded-lg border border-dark-700 px-3 py-2 text-sm">
                  {isMuted ? <Volume2 size={16} className="inline mr-1" /> : <MicOff size={16} className="inline mr-1" />}
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button type="button" onClick={handleScreenshot} className="rounded-lg border border-dark-700 px-3 py-2 text-sm">
                  Screenshot
                </button>
                <button type="button" onClick={toggleFullscreen} className="rounded-lg border border-dark-700 px-3 py-2 text-sm">
                  <Expand size={16} className="inline mr-1" />
                  Fullscreen
                </button>
              </div>
            </div>

            <div className="relative aspect-video overflow-hidden rounded-lg border border-dark-700 bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              {!streamActive ? (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
                  Waiting for camera stream...
                </div>
              ) : null}
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
              {cameras.map((camera) => (
                <div key={camera.id} className="flex items-center justify-between rounded-lg border border-dark-700 p-3">
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
                    <button
                      type="button"
                      className="rounded border border-dark-700 px-2 py-1 text-xs hover:border-primary-500"
                      onClick={() => handleRenameCamera(camera.id, camera.name)}
                    >
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
              ))}
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
                    </div>
                    <div className="flex gap-2">
                      <a
                        className="rounded border border-dark-700 px-2 py-1 text-xs hover:border-primary-500"
                        href={`${env.serverUrl}/${recording.filePath}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download size={12} className="inline mr-1" />
                        Download
                      </a>
                      <button
                        type="button"
                        className="rounded border border-red-500/50 px-2 py-1 text-xs text-red-300"
                        onClick={() => removeRecording(recording.id)}
                      >
                        <Trash2 size={12} className="inline mr-1" />
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
          Logged in as {currentUser?.email || 'N/A'} · Backend {env.serverUrl}
        </footer>
      </div>
    </div>
  );
}