import path from 'path';
import fs from 'fs/promises';
import { env } from '../config/env.js';
import { createId } from '../utils/id.js';

function storageRoot() {
  return path.resolve(process.cwd(), env.localStorageRoot);
}

async function ensureDir(relativeDir) {
  const dir = path.join(storageRoot(), relativeDir);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function extensionFromMime(mimeType, fallback = 'bin') {
  if (!mimeType) return fallback;
  const [, subtype] = mimeType.split('/');
  if (!subtype) return fallback;
  return subtype.split(';')[0].toLowerCase();
}

export async function saveDataUrlImage(dataUrl, cameraId) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) {
    throw new Error('Invalid screenshot data URL.');
  }

  const extension = extensionFromMime(match[1], 'jpg');
  const buffer = Buffer.from(match[2], 'base64');
  const dir = await ensureDir(path.join('events', cameraId));
  const fileName = `${Date.now()}-${createId()}.${extension}`;
  const fullPath = path.join(dir, fileName);
  await fs.writeFile(fullPath, buffer);
  return path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
}

export async function saveBase64Video(base64Data, mimeType, cameraId) {
  if (!base64Data || typeof base64Data !== 'string') {
    throw new Error('Recording data is missing.');
  }

  const extension = extensionFromMime(mimeType, 'webm');
  const buffer = Buffer.from(base64Data, 'base64');
  const dir = await ensureDir(path.join('recordings', cameraId));
  const fileName = `${Date.now()}-${createId()}.${extension}`;
  const fullPath = path.join(dir, fileName);
  await fs.writeFile(fullPath, buffer);
  return {
    filePath: path.relative(process.cwd(), fullPath).replace(/\\/g, '/'),
    sizeBytes: buffer.length,
  };
}

export async function deleteStoredFile(relativePath) {
  if (!relativePath) return;
  const normalized = relativePath.replace(/\//g, path.sep);
  const fullPath = path.resolve(process.cwd(), normalized);
  await fs.unlink(fullPath);
}

async function folderSize(dir) {
  let total = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const itemPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await folderSize(itemPath);
    } else if (entry.isFile()) {
      const stat = await fs.stat(itemPath);
      total += stat.size;
    }
  }
  return total;
}

export async function getStorageUsageBytes() {
  try {
    return await folderSize(storageRoot());
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
}
