import fs from 'fs';
import { google } from 'googleapis';
import { config } from '../config/index.js';

let driveClient = null;

function getDriveClient() {
  if (driveClient) return driveClient;

  if (!fs.existsSync(config.googleServiceAccountKeyPath)) {
    throw new Error(
      `Google service account key not found at ${config.googleServiceAccountKeyPath}. ` +
        'Create one in Google Cloud Console (IAM > Service Accounts), download the JSON key, ' +
        'and point GOOGLE_SERVICE_ACCOUNT_KEY_PATH at it in local-bridge/.env'
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: config.googleServiceAccountKeyPath,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

/**
 * Uploads a recording/screenshot file to the configured Google Drive folder.
 * Returns the Drive file id + a shareable link on success.
 */
export async function uploadToDrive(localFilePath, driveFileName) {
  const drive = getDriveClient();

  const res = await drive.files.create({
    requestBody: {
      name: driveFileName,
      parents: config.googleDriveFolderId ? [config.googleDriveFolderId] : undefined,
    },
    media: {
      body: fs.createReadStream(localFilePath),
    },
    fields: 'id, webViewLink',
  });

  console.log(`☁️  Uploaded ${driveFileName} -> ${res.data.webViewLink}`);
  return { fileId: res.data.id, link: res.data.webViewLink };
}
