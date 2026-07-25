import 'dotenv/config';

export const config = {
  cloudServerUrl: process.env.CLOUD_SERVER_URL || 'http://localhost:5000',
  bridgeName: process.env.BRIDGE_NAME || 'Local-Bridge',
  googleServiceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-credentials.json',
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
};
