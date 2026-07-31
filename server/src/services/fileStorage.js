import path from 'path';
import fs from 'fs/promises';
import { env } from '../config/env.js';
import { createId } from '../utils/id.js';

function storageRoot() {
  return path.resolve(process.cwd(), env.localStorageRoot);
}

export function resolveStorageAbsolutePath(relativePath) {
  const normalized = normalizeStoragePath(relativePath).replace(/\//g, path.sep);
  return path.resolve(storageRoot(), normalized);
}

export function normalizeStoragePath(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') return '';
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const storagePrefix = `${env.localStorageRoot.replace(/\\/g, '/')}/`;
  if (normalized.startsWith(storagePrefix)) {
    return normalized.slice(storagePrefix.length);
  }
  return normalized;
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

function normalizeSegment(value, fallback = 'item') {
  const segment = String(value || fallback)
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return segment || fallback;
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
  return normalizeStoragePath(path.relative(storageRoot(), fullPath));
}

export async function saveBase64Video(base64Data, mimeType, cameraId, createdAt = new Date().toISOString()) {
  if (!base64Data || typeof base64Data !== 'string') {
    throw new Error('Recording data is missing.');
  }

  const extension = extensionFromMime(mimeType, 'webm');
  const buffer = Buffer.from(base64Data, 'base64');
  const created = new Date(createdAt);
  const yyyy = created.getUTCFullYear();
  const mm = String(created.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(created.getUTCDate()).padStart(2, '0');
  const dir = await ensureDir(path.join('recordings', normalizeSegment(cameraId, 'camera'), `${yyyy}-${mm}-${dd}`));
  const hh = String(created.getUTCHours()).padStart(2, '0');
  const min = String(created.getUTCMinutes()).padStart(2, '0');
  const sec = String(created.getUTCSeconds()).padStart(2, '0');
  const fileName = `${normalizeSegment(cameraId, 'camera')}_${yyyy}${mm}${dd}_${hh}${min}${sec}_${createId()}.${extension}`;
  const fullPath = path.join(dir, fileName);
  await fs.writeFile(fullPath, buffer);
  return {
    filePath: normalizeStoragePath(path.relative(storageRoot(), fullPath)),
    sizeBytes: buffer.length,
    originalFileName: fileName,
  };
}

export async function deleteStoredFile(relativePath) {
  if (!relativePath) return;
  const fullPath = resolveStorageAbsolutePath(relativePath);
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
