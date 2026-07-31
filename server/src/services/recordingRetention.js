import fs from 'fs/promises';
import { env } from '../config/env.js';
import { store } from './dataStore.js';
import { deleteStoredFile, resolveStorageAbsolutePath } from './fileStorage.js';
import { deleteDriveFile } from './driveStorage.js';

function retentionMs() {
  return env.recordingsRetentionDays * 24 * 60 * 60 * 1000;
}

function cutoffTimestamp() {
  return Date.now() - retentionMs();
}

export async function cleanupExpiredRecordings() {
  const recordings = await store.listRecordings(0);
  const cutoff = cutoffTimestamp();
  const expired = recordings.filter((recording) => {
    const timestamp = new Date(recording.createdAt).getTime();
    return Number.isFinite(timestamp) && timestamp < cutoff;
  });

  for (const recording of expired) {
    await store.deleteRecording(recording.id);
    try {
      await deleteStoredFile(recording.filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    if (recording.driveFileId) {
      try {
        await deleteDriveFile(recording.driveFileId);
      } catch (error) {
        if (error.code !== 404) {
          throw error;
        }
      }
    }
  }

  return expired.length;
}

export async function runRetentionSweepWithEventLog() {
  const removed = await cleanupExpiredRecordings();
  if (removed > 0) {
    await store.createEvent({
      type: 'system',
      cameraId: 'system',
      cameraName: 'Retention',
      message: `Auto-retention removed ${removed} recording(s) older than ${env.recordingsRetentionDays} days.`,
      severity: 'info',
      createdAt: new Date().toISOString(),
    });
  }
}

export async function fileExistsInStorage(relativePath) {
  try {
    await fs.access(resolveStorageAbsolutePath(relativePath));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
