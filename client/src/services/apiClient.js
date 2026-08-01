import { auth } from './firebase';
import { env } from '../config/env';

async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await getAuthHeaders()),
    ...(options.headers || {}),
  };

  const response = await fetch(`${env.serverUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch {
      // Keep default fallback message.
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const apiClient = {
  getDashboardSummary: () => request('/api/dashboard/summary'),
  listCameras: () => request('/api/cameras'),
  addCamera: (payload) => request('/api/cameras', { method: 'POST', body: JSON.stringify(payload) }),
  renameCamera: (cameraId, payload) =>
    request(`/api/cameras/${cameraId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  removeCamera: (cameraId) => request(`/api/cameras/${cameraId}`, { method: 'DELETE' }),
  listEvents: () => request('/api/events'),
  listRecordings: () => request('/api/recordings'),
  createCameraInviteCode: (expiresInMinutes = 15) =>
    request('/api/camera-access/invite-codes', {
      method: 'POST',
      body: JSON.stringify({ expiresInMinutes }),
    }),
  requestCameraAccess: (payload) =>
    request('/api/camera-access/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteRecording: (recordingId) => request(`/api/recordings/${recordingId}`, { method: 'DELETE' }),
  getRecordingDownloadUrl: (recordingId, source = 'auto') =>
    `${env.serverUrl}/api/recordings/${recordingId}/download?source=${source}`,
};
