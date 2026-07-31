import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { env } from '../config/env.js';

let driveClient = null;

function hasDriveConfig() {
  return Boolean(env.googleServiceAccountKeyPath && env.googleDriveFolderId);
}

function getDriveClient() {
  if (driveClient) return driveClient;
  if (!hasDriveConfig()) return null;

  const keyPath = path.resolve(process.cwd(), env.googleServiceAccountKeyPath);
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Google service account key not found at ${keyPath}`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

export function isDriveSyncEnabled() {
  return hasDriveConfig();
}

function normalizeFolderName(value, fallback = 'unknown') {
  return String(value || fallback)
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

async function ensureDriveFolder(drive, name, parentId) {
  const queryParts = [
    `mimeType='application/vnd.google-apps.folder'`,
    `name='${name.replace(/'/g, "\\'")}'`,
    'trashed=false',
  ];
  if (parentId) {
    queryParts.push(`'${parentId}' in parents`);
  }

  const list = await drive.files.list({
    q: queryParts.join(' and '),
    fields: 'files(id, name)',
    pageSize: 1,
  });

  const existing = list.data.files?.[0];
  if (existing?.id) return existing.id;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
  });

  return created.data.id;
}

function buildDrivePath(cameraId, createdAt) {
  const created = new Date(createdAt);
  const yyyy = created.getUTCFullYear();
  const mm = String(created.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(created.getUTCDate()).padStart(2, '0');
  return {
    cameraFolder: normalizeFolderName(cameraId, 'camera'),
    dateFolder: `${yyyy}-${mm}-${dd}`,
  };
}

export async function uploadRecordingFileToDrive(localFilePath, options) {
  const drive = getDriveClient();
  if (!drive) return null;
  const { cameraId, createdAt, fileName } = options;

  const { cameraFolder, dateFolder } = buildDrivePath(cameraId, createdAt);
  const cameraFolderId = await ensureDriveFolder(drive, cameraFolder, env.googleDriveFolderId);
  const dateFolderId = await ensureDriveFolder(drive, dateFolder, cameraFolderId);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [dateFolderId],
    },
    media: {
      body: fs.createReadStream(localFilePath),
    },
    fields: 'id, webViewLink, webContentLink',
  });

  return {
    driveFileId: response.data.id || '',
    driveLink: response.data.webViewLink || '',
    drivePath: `${cameraFolder}/${dateFolder}/${fileName}`,
    driveDownloadLink: response.data.webContentLink || '',
  };
}

export async function deleteDriveFile(driveFileId) {
  if (!driveFileId) return;
  const drive = getDriveClient();
  if (!drive) return;
  await drive.files.delete({ fileId: driveFileId });
}

export async function getDriveFileMeta(driveFileId) {
  const drive = getDriveClient();
  if (!drive) return null;
  const response = await drive.files.get({
    fileId: driveFileId,
    fields: 'id, name, mimeType',
  });
  return response.data;
}

export async function createDriveDownloadStream(driveFileId) {
  const drive = getDriveClient();
  if (!drive) return null;
  const meta = await getDriveFileMeta(driveFileId);
  const response = await drive.files.get(
    {
      fileId: driveFileId,
      alt: 'media',
    },
    {
      responseType: 'stream',
    }
  );

  return {
    stream: response.data,
    fileName: meta?.name || 'recording.webm',
    mimeType: meta?.mimeType || 'application/octet-stream',
  };
}
