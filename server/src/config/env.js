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
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  recordingsRetentionDays: Number(process.env.RECORDINGS_RETENTION_DAYS || 30),
  retentionSweepIntervalMinutes: Number(process.env.RETENTION_SWEEP_INTERVAL_MINUTES || 60),
  cameraInviteCodeExpiryMinutes: Number(process.env.CAMERA_INVITE_CODE_EXPIRY_MINUTES || 15),
};
