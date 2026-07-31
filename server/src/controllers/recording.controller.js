import { store } from '../services/dataStore.js';
import { deleteStoredFile, normalizeStoragePath } from '../services/fileStorage.js';
import { resolveStorageAbsolutePath } from '../services/fileStorage.js';
import { createDriveDownloadStream } from '../services/driveStorage.js';
import { deleteDriveFile } from '../services/driveStorage.js';
import fs from 'fs/promises';
import path from 'path';
import { HttpError } from '../utils/httpError.js';

function serializeRecording(recording) {
  const normalizedPath = normalizeStoragePath(recording.filePath);
  return {
    ...recording,
    filePath: normalizedPath,
    localDownloadPath: `/api/recordings/${recording.id}/download?source=local`,
    cloudDownloadPath: `/api/recordings/${recording.id}/download?source=drive`,
    autoDownloadPath: `/api/recordings/${recording.id}/download?source=auto`,
  };
}

export async function listRecordings(req, res) {
  const recordings = await store.listRecordings(200);
  res.json({ recordings: recordings.map(serializeRecording) });
}

export async function createRecording(req, res) {
  const recording = await store.createRecording(req.body);
  res.status(201).json({ recording: serializeRecording(recording) });
}

export async function deleteRecording(req, res) {
  const recording = await store.deleteRecording(req.params.recordingId);
  if (recording.filePath) {
    await deleteStoredFile(recording.filePath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  if (recording.driveFileId) {
    await deleteDriveFile(recording.driveFileId).catch((error) => {
      if (error.code !== 404) throw error;
    });
  }
  res.status(204).send();
}

async function localFileExists(filePath) {
  if (!filePath) return false;
  try {
    await fs.access(resolveStorageAbsolutePath(filePath));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function buildDownloadFileName(recording) {
  if (recording.originalFileName) return recording.originalFileName;
  const extension = path.extname(recording.filePath || '') || '.webm';
  const stamp = new Date(recording.createdAt || new Date().toISOString())
    .toISOString()
    .replace(/[:.]/g, '-');
  return `${recording.cameraId || 'camera'}_${stamp}${extension}`;
}

async function sendLocalRecording(res, recording) {
  const absolutePath = resolveStorageAbsolutePath(recording.filePath);
  res.download(absolutePath, buildDownloadFileName(recording));
}

async function sendDriveRecording(res, recording) {
  if (!recording.driveFileId) {
    throw new HttpError(404, 'Cloud copy is not available for this recording.');
  }

  const download = await createDriveDownloadStream(recording.driveFileId);
  if (!download) {
    throw new HttpError(503, 'Google Drive is not configured on the server.');
  }

  res.setHeader('Content-Type', download.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${download.fileName}"`);
  download.stream.pipe(res);
}

export async function downloadRecording(req, res) {
  const source = String(req.query.source || 'auto').toLowerCase();
  if (!['auto', 'local', 'drive'].includes(source)) {
    throw new HttpError(400, "source must be one of: 'auto', 'local', 'drive'.");
  }

  const recording = await store.getRecording(req.params.recordingId);
  if (!recording) {
    throw new HttpError(404, 'Recording not found.');
  }

  const hasLocal = await localFileExists(recording.filePath);

  if (source === 'local') {
    if (!hasLocal) throw new HttpError(404, 'Local recording file is missing.');
    await sendLocalRecording(res, recording);
    return;
  }

  if (source === 'drive') {
    await sendDriveRecording(res, recording);
    return;
  }

  if (hasLocal) {
    await sendLocalRecording(res, recording);
    return;
  }

  if (recording.driveFileId) {
    await sendDriveRecording(res, recording);
    return;
  }

  throw new HttpError(404, 'Recording file is missing from local and cloud storage.');
}
