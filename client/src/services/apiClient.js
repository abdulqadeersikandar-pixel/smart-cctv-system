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
      const body = await response.json();
      message = body.error || message;
    } catch {
      // Use default message when body is not JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const apiClient = {
  getDashboardSummary: () => request('/api/dashboard/summary'),
  listCameras: () => request('/api/cameras'),
  addCamera: (payload) =>
    request('/api/cameras', { method: 'POST', body: JSON.stringify(payload) }),
  renameCamera: (cameraId, payload) =>
    request(`/api/cameras/${cameraId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  removeCamera: (cameraId) => request(`/api/cameras/${cameraId}`, { method: 'DELETE' }),
  listEvents: () => request('/api/events'),
  listRecordings: () => request('/api/recordings'),
  deleteRecording: (recordingId) => request(`/api/recordings/${recordingId}`, { method: 'DELETE' }),
};
