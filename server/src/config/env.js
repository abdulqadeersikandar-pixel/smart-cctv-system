import 'dotenv/config';

function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

function parseOrigins(value) {
  if (!value) return ['http://localhost:5173'];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseIceServers(value) {
  if (!value) return [];
  try {
    // Accept JSON array or comma separated host:port:user:pass entries (simple)
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    // fallback to comma-separated STUN/TURN entries (not full RTC config)
    return value.split(',').map((s) => s.trim()).filter(Boolean).map((url) => ({ urls: url }));
  }
  return [];
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  clientOrigins: parseOrigins(process.env.CLIENT_URL),
  storageProvider: process.env.STORAGE_PROVIDER || 'local',
  requireAuth: parseBoolean(process.env.REQUIRE_AUTH, false),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY || '',
  localStorageRoot: process.env.LOCAL_STORAGE_ROOT || 'storage',
  googleServiceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || '',
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  recordingsRetentionDays: Number(process.env.RECORDINGS_RETENTION_DAYS || 30),
  retentionSweepIntervalMinutes: Number(process.env.RETENTION_SWEEP_INTERVAL_MINUTES || 60),
  cameraInviteCodeExpiryMinutes: Number(process.env.CAMERA_INVITE_CODE_EXPIRY_MINUTES || 15),
  // Admin secret header to protect manual admin endpoints (set in production)
  adminSecret: process.env.ADMIN_SECRET || '',
  // ICE servers config for WebRTC (JSON array or comma-separated URLs)
  iceServers: parseIceServers(process.env.ICE_SERVERS || ''),
};
