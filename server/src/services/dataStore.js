import path from 'path';
import fs from 'fs/promises';
import { env } from '../config/env.js';
import { createId } from '../utils/id.js';
import { getFirestore, hasFirebaseAdmin } from '../config/firebaseAdmin.js';
import { HttpError } from '../utils/httpError.js';

function nowIso() {
  return new Date().toISOString();
}

class LocalStore {
  constructor() {
    this.dbPath = path.resolve(process.cwd(), env.localStorageRoot, 'db.json');
    this.writeQueue = Promise.resolve();
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    try {
      await fs.access(this.dbPath);
    } catch (error) {
      const initial = { cameras: [], events: [], recordings: [] };
      await fs.writeFile(this.dbPath, JSON.stringify(initial, null, 2), 'utf-8');
    }
  }

  async readDb() {
    const raw = await fs.readFile(this.dbPath, 'utf-8');
    return JSON.parse(raw);
  }

  async writeDb(nextDb) {
    this.writeQueue = this.writeQueue.then(() =>
      fs.writeFile(this.dbPath, JSON.stringify(nextDb, null, 2), 'utf-8')
    );
    await this.writeQueue;
  }

  async listCameras() {
    const db = await this.readDb();
    return db.cameras;
  }

  async createCamera(payload) {
    const db = await this.readDb();
    const camera = {
      id: createId(),
      name: payload.name.trim(),
      sourceType: payload.sourceType,
      sourceUrl: payload.sourceUrl || '',
      status: 'offline',
      health: 'offline',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastSeenAt: null,
    };
    db.cameras.push(camera);
    await this.writeDb(db);
    return camera;
  }

  async updateCamera(cameraId, payload) {
    const db = await this.readDb();
    const camera = db.cameras.find((item) => item.id === cameraId);
    if (!camera) {
      throw new HttpError(404, 'Camera not found.');
    }

    if (payload.name !== undefined) camera.name = payload.name.trim();
    if (payload.sourceType !== undefined) camera.sourceType = payload.sourceType;
    if (payload.sourceUrl !== undefined) camera.sourceUrl = payload.sourceUrl;
    camera.updatedAt = nowIso();
    await this.writeDb(db);
    return camera;
  }

  async deleteCamera(cameraId) {
    const db = await this.readDb();
    const before = db.cameras.length;
    db.cameras = db.cameras.filter((camera) => camera.id !== cameraId);
    if (db.cameras.length === before) {
      throw new HttpError(404, 'Camera not found.');
    }
    await this.writeDb(db);
  }

  async markCameraOnline(cameraId, name, sourceType = 'phone') {
    const db = await this.readDb();
    let camera = db.cameras.find((item) => item.id === cameraId);
    if (!camera) {
      camera = {
        id: cameraId,
        name: name || `Camera ${cameraId}`,
        sourceType,
        sourceUrl: '',
        status: 'online',
        health: 'healthy',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        lastSeenAt: nowIso(),
      };
      db.cameras.push(camera);
    } else {
      camera.status = 'online';
      camera.health = 'healthy';
      camera.lastSeenAt = nowIso();
      camera.updatedAt = nowIso();
    }
    await this.writeDb(db);
    return camera;
  }

  async markCameraOffline(cameraId) {
    const db = await this.readDb();
    const camera = db.cameras.find((item) => item.id === cameraId);
    if (!camera) return null;
    camera.status = 'offline';
    camera.health = 'offline';
    camera.updatedAt = nowIso();
    await this.writeDb(db);
    return camera;
  }

  async listEvents(limit = 50) {
    const db = await this.readDb();
    return db.events.slice(-limit).reverse();
  }

  async createEvent(payload) {
    const db = await this.readDb();
    const event = {
      id: createId(),
      type: payload.type,
      cameraId: payload.cameraId,
      cameraName: payload.cameraName,
      message: payload.message,
      screenshotPath: payload.screenshotPath || '',
      videoPath: payload.videoPath || '',
      createdAt: payload.createdAt || nowIso(),
      severity: payload.severity || 'info',
    };
    db.events.push(event);
    await this.writeDb(db);
    return event;
  }

  async listRecordings(limit = 100) {
    const db = await this.readDb();
    return db.recordings.slice(-limit).reverse();
  }

  async createRecording(payload) {
    const db = await this.readDb();
    const recording = {
      id: createId(),
      cameraId: payload.cameraId,
      cameraName: payload.cameraName,
      trigger: payload.trigger,
      filePath: payload.filePath,
      sizeBytes: payload.sizeBytes || 0,
      durationSeconds: payload.durationSeconds || 0,
      createdAt: payload.createdAt || nowIso(),
    };
    db.recordings.push(recording);
    await this.writeDb(db);
    return recording;
  }

  async deleteRecording(recordingId) {
    const db = await this.readDb();
    const recording = db.recordings.find((item) => item.id === recordingId);
    if (!recording) throw new HttpError(404, 'Recording not found.');
    db.recordings = db.recordings.filter((item) => item.id !== recordingId);
    await this.writeDb(db);
    return recording;
  }
}

class FirestoreStore {
  constructor() {
    this.db = getFirestore();
  }

  async initialize() {
    return undefined;
  }

  async listCameras() {
    const snapshot = await this.db.collection('cameras').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createCamera(payload) {
    const data = {
      name: payload.name.trim(),
      sourceType: payload.sourceType,
      sourceUrl: payload.sourceUrl || '',
      status: 'offline',
      health: 'offline',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastSeenAt: null,
    };
    const ref = await this.db.collection('cameras').add(data);
    return { id: ref.id, ...data };
  }

  async updateCamera(cameraId, payload) {
    const ref = this.db.collection('cameras').doc(cameraId);
    const doc = await ref.get();
    if (!doc.exists) throw new HttpError(404, 'Camera not found.');

    const updateData = { updatedAt: nowIso() };
    if (payload.name !== undefined) updateData.name = payload.name.trim();
    if (payload.sourceType !== undefined) updateData.sourceType = payload.sourceType;
    if (payload.sourceUrl !== undefined) updateData.sourceUrl = payload.sourceUrl;
    await ref.update(updateData);
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() };
  }

  async deleteCamera(cameraId) {
    const ref = this.db.collection('cameras').doc(cameraId);
    const doc = await ref.get();
    if (!doc.exists) throw new HttpError(404, 'Camera not found.');
    await ref.delete();
  }

  async markCameraOnline(cameraId, name, sourceType = 'phone') {
    const ref = this.db.collection('cameras').doc(cameraId);
    const doc = await ref.get();
    const base = {
      name: name || `Camera ${cameraId}`,
      sourceType,
      sourceUrl: '',
      status: 'online',
      health: 'healthy',
      lastSeenAt: nowIso(),
      updatedAt: nowIso(),
    };
    if (doc.exists) {
      await ref.update(base);
    } else {
      await ref.set({ ...base, createdAt: nowIso() });
    }
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() };
  }

  async markCameraOffline(cameraId) {
    const ref = this.db.collection('cameras').doc(cameraId);
    const doc = await ref.get();
    if (!doc.exists) return null;
    await ref.update({
      status: 'offline',
      health: 'offline',
      updatedAt: nowIso(),
    });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() };
  }

  async listEvents(limit = 50) {
    const snapshot = await this.db
      .collection('events')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createEvent(payload) {
    const data = {
      type: payload.type,
      cameraId: payload.cameraId,
      cameraName: payload.cameraName,
      message: payload.message,
      screenshotPath: payload.screenshotPath || '',
      videoPath: payload.videoPath || '',
      createdAt: payload.createdAt || nowIso(),
      severity: payload.severity || 'info',
    };
    const ref = await this.db.collection('events').add(data);
    return { id: ref.id, ...data };
  }

  async listRecordings(limit = 100) {
    const snapshot = await this.db
      .collection('recordings')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createRecording(payload) {
    const data = {
      cameraId: payload.cameraId,
      cameraName: payload.cameraName,
      trigger: payload.trigger,
      filePath: payload.filePath,
      sizeBytes: payload.sizeBytes || 0,
      durationSeconds: payload.durationSeconds || 0,
      createdAt: payload.createdAt || nowIso(),
    };
    const ref = await this.db.collection('recordings').add(data);
    return { id: ref.id, ...data };
  }

  async deleteRecording(recordingId) {
    const ref = this.db.collection('recordings').doc(recordingId);
    const doc = await ref.get();
    if (!doc.exists) throw new HttpError(404, 'Recording not found.');
    const recording = { id: doc.id, ...doc.data() };
    await ref.delete();
    return recording;
  }
}

function createStore() {
  if (env.storageProvider === 'firestore') {
    if (!hasFirebaseAdmin) {
      throw new Error(
        "STORAGE_PROVIDER is 'firestore' but Firebase Admin credentials are missing in .env."
      );
    }
    return new FirestoreStore();
  }
  return new LocalStore();
}

export const store = createStore();
