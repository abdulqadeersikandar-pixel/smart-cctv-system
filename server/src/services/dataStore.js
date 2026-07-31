import path from 'path';
import fs from 'fs/promises';
import { env } from '../config/env.js';
import { createId } from '../utils/id.js';
import { getFirestore, hasFirebaseAdmin } from '../config/firebaseAdmin.js';
import { HttpError } from '../utils/httpError.js';

function nowIso() {
  return new Date().toISOString();
}

function normalizeInviteCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase();
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
      const initial = {
        cameras: [],
        events: [],
        recordings: [],
        cameraInviteCodes: [],
        cameraRequests: [],
      };
      await fs.writeFile(this.dbPath, JSON.stringify(initial, null, 2), 'utf-8');
    }
  }

  async readDb() {
    const raw = await fs.readFile(this.dbPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      cameras: parsed.cameras || [],
      events: parsed.events || [],
      recordings: parsed.recordings || [],
      cameraInviteCodes: parsed.cameraInviteCodes || [],
      cameraRequests: parsed.cameraRequests || [],
    };
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
      isAuthorized: payload.isAuthorized ?? true,
      approvalStatus: payload.approvalStatus || 'approved',
      approvedAt: payload.approvedAt || nowIso(),
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
    if (limit <= 0) return [...db.recordings].reverse();
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
      originalFileName: payload.originalFileName || '',
      mimeType: payload.mimeType || '',
      sizeBytes: payload.sizeBytes || 0,
      durationSeconds: payload.durationSeconds || 0,
      createdAt: payload.createdAt || nowIso(),
      driveFileId: payload.driveFileId || '',
      driveLink: payload.driveLink || '',
      driveDownloadLink: payload.driveDownloadLink || '',
      drivePath: payload.drivePath || '',
      uploadStatus: payload.uploadStatus || 'local_only', // local_only | pending | uploading | uploaded | failed
      uploadError: payload.uploadError || '',
      uploadedAt: payload.uploadedAt || null,
    };
    db.recordings.push(recording);
    await this.writeDb(db);
    return recording;
  }

  async updateRecording(recordingId, payload) {
    const db = await this.readDb();
    const recording = db.recordings.find((item) => item.id === recordingId);
    if (!recording) throw new HttpError(404, 'Recording not found.');
    Object.assign(recording, payload);
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

  async getRecording(recordingId) {
    const db = await this.readDb();
    return db.recordings.find((item) => item.id === recordingId) || null;
  }

  async createCameraInviteCode(payload) {
    const db = await this.readDb();
    const invite = {
      id: createId(),
      code: normalizeInviteCode(payload.code),
      createdAt: nowIso(),
      createdBy: payload.createdBy || '',
      expiresAt: payload.expiresAt,
      usedAt: null,
      usedForCameraId: '',
    };
    db.cameraInviteCodes.push(invite);
    await this.writeDb(db);
    return invite;
  }

  async getCameraInviteCode(code) {
    const db = await this.readDb();
    const normalized = normalizeInviteCode(code);
    return db.cameraInviteCodes.find((item) => item.code === normalized) || null;
  }

  async consumeCameraInviteCode(code, usedForCameraId) {
    const db = await this.readDb();
    const normalized = normalizeInviteCode(code);
    const invite = db.cameraInviteCodes.find((item) => item.code === normalized);
    if (!invite) throw new HttpError(404, 'Invite code not found.');
    invite.usedAt = nowIso();
    invite.usedForCameraId = usedForCameraId;
    await this.writeDb(db);
    return invite;
  }

  async createCameraRequest(payload) {
    const db = await this.readDb();
    const request = {
      id: createId(),
      cameraId: payload.cameraId,
      cameraName: payload.cameraName,
      sourceType: payload.sourceType,
      sourceUrl: payload.sourceUrl || '',
      inviteCode: normalizeInviteCode(payload.inviteCode),
      status: 'pending',
      requestedAt: nowIso(),
      reviewedAt: null,
      reviewedBy: '',
      rejectionReason: '',
    };
    db.cameraRequests.push(request);
    await this.writeDb(db);
    return request;
  }

  async getCameraRequest(requestId) {
    const db = await this.readDb();
    return db.cameraRequests.find((item) => item.id === requestId) || null;
  }

  async getLatestCameraRequestByCameraId(cameraId) {
    const db = await this.readDb();
    const matches = db.cameraRequests.filter((item) => item.cameraId === cameraId);
    return matches.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))[0] || null;
  }

  async listPendingCameraRequests() {
    const db = await this.readDb();
    return db.cameraRequests
      .filter((item) => item.status === 'pending')
      .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  }

  async updateCameraRequestStatus(requestId, payload) {
    const db = await this.readDb();
    const request = db.cameraRequests.find((item) => item.id === requestId);
    if (!request) throw new HttpError(404, 'Camera request not found.');

    request.status = payload.status;
    request.reviewedAt = nowIso();
    request.reviewedBy = payload.reviewedBy || '';
    request.rejectionReason = payload.rejectionReason || '';
    await this.writeDb(db);
    return request;
  }

  async upsertApprovedCameraFromRequest(request) {
    const db = await this.readDb();
    let camera = db.cameras.find((item) => item.id === request.cameraId);
    if (!camera) {
      camera = {
        id: request.cameraId,
        name: request.cameraName,
        sourceType: request.sourceType,
        sourceUrl: request.sourceUrl || '',
        isAuthorized: true,
        approvalStatus: 'approved',
        approvedAt: nowIso(),
        status: 'offline',
        health: 'offline',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        lastSeenAt: null,
      };
      db.cameras.push(camera);
    } else {
      camera.name = request.cameraName;
      camera.sourceType = request.sourceType;
      camera.sourceUrl = request.sourceUrl || camera.sourceUrl || '';
      camera.isAuthorized = true;
      camera.approvalStatus = 'approved';
      camera.approvedAt = nowIso();
      camera.updatedAt = nowIso();
    }
    await this.writeDb(db);
    return camera;
  }

  async isCameraAuthorized(cameraId) {
    const db = await this.readDb();
    const camera = db.cameras.find((item) => item.id === cameraId);
    if (!camera) return false;
    return camera.isAuthorized !== false && camera.approvalStatus !== 'rejected';
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
      isAuthorized: payload.isAuthorized ?? true,
      approvalStatus: payload.approvalStatus || 'approved',
      approvedAt: payload.approvedAt || nowIso(),
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
    let query = this.db.collection('recordings').orderBy('createdAt', 'desc');
    if (limit > 0) {
      query = query.limit(limit);
    }
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createRecording(payload) {
    const data = {
      cameraId: payload.cameraId,
      cameraName: payload.cameraName,
      trigger: payload.trigger,
      filePath: payload.filePath,
      originalFileName: payload.originalFileName || '',
      mimeType: payload.mimeType || '',
      sizeBytes: payload.sizeBytes || 0,
      durationSeconds: payload.durationSeconds || 0,
      createdAt: payload.createdAt || nowIso(),
      driveFileId: payload.driveFileId || '',
      driveLink: payload.driveLink || '',
      driveDownloadLink: payload.driveDownloadLink || '',
      drivePath: payload.drivePath || '',
      uploadStatus: payload.uploadStatus || 'local_only',
      uploadError: payload.uploadError || '',
      uploadedAt: payload.uploadedAt || null,
    };
    const ref = await this.db.collection('recordings').add(data);
    return { id: ref.id, ...data };
  }

  async updateRecording(recordingId, payload) {
    const ref = this.db.collection('recordings').doc(recordingId);
    const doc = await ref.get();
    if (!doc.exists) throw new HttpError(404, 'Recording not found.');
    await ref.update(payload);
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() };
  }

  async deleteRecording(recordingId) {
    const ref = this.db.collection('recordings').doc(recordingId);
    const doc = await ref.get();
    if (!doc.exists) throw new HttpError(404, 'Recording not found.');
    const recording = { id: doc.id, ...doc.data() };
    await ref.delete();
    return recording;
  }

  async getRecording(recordingId) {
    const ref = this.db.collection('recordings').doc(recordingId);
    const doc = await ref.get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  async createCameraInviteCode(payload) {
    const data = {
      code: normalizeInviteCode(payload.code),
      createdAt: nowIso(),
      createdBy: payload.createdBy || '',
      expiresAt: payload.expiresAt,
      usedAt: null,
      usedForCameraId: '',
    };
    const ref = await this.db.collection('cameraInviteCodes').add(data);
    return { id: ref.id, ...data };
  }

  async getCameraInviteCode(code) {
    const normalized = normalizeInviteCode(code);
    const snapshot = await this.db
      .collection('cameraInviteCodes')
      .where('code', '==', normalized)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async consumeCameraInviteCode(code, usedForCameraId) {
    const invite = await this.getCameraInviteCode(code);
    if (!invite) throw new HttpError(404, 'Invite code not found.');
    const ref = this.db.collection('cameraInviteCodes').doc(invite.id);
    await ref.update({
      usedAt: nowIso(),
      usedForCameraId,
    });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() };
  }

  async createCameraRequest(payload) {
    const data = {
      cameraId: payload.cameraId,
      cameraName: payload.cameraName,
      sourceType: payload.sourceType,
      sourceUrl: payload.sourceUrl || '',
      inviteCode: normalizeInviteCode(payload.inviteCode),
      status: 'pending',
      requestedAt: nowIso(),
      reviewedAt: null,
      reviewedBy: '',
      rejectionReason: '',
    };
    const ref = await this.db.collection('cameraRequests').add(data);
    return { id: ref.id, ...data };
  }

  async getCameraRequest(requestId) {
    const ref = this.db.collection('cameraRequests').doc(requestId);
    const doc = await ref.get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  async getLatestCameraRequestByCameraId(cameraId) {
    const snapshot = await this.db
      .collection('cameraRequests')
      .where('cameraId', '==', cameraId)
      .orderBy('requestedAt', 'desc')
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async listPendingCameraRequests() {
    const snapshot = await this.db
      .collection('cameraRequests')
      .where('status', '==', 'pending')
      .orderBy('requestedAt', 'desc')
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async updateCameraRequestStatus(requestId, payload) {
    const ref = this.db.collection('cameraRequests').doc(requestId);
    const doc = await ref.get();
    if (!doc.exists) throw new HttpError(404, 'Camera request not found.');
    await ref.update({
      status: payload.status,
      reviewedAt: nowIso(),
      reviewedBy: payload.reviewedBy || '',
      rejectionReason: payload.rejectionReason || '',
    });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() };
  }

  async upsertApprovedCameraFromRequest(request) {
    const ref = this.db.collection('cameras').doc(request.cameraId);
    const base = {
      name: request.cameraName,
      sourceType: request.sourceType,
      sourceUrl: request.sourceUrl || '',
      isAuthorized: true,
      approvalStatus: 'approved',
      approvedAt: nowIso(),
      status: 'offline',
      health: 'offline',
      updatedAt: nowIso(),
    };
    const current = await ref.get();
    if (current.exists) {
      await ref.update(base);
    } else {
      await ref.set({
        ...base,
        createdAt: nowIso(),
        lastSeenAt: null,
      });
    }
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() };
  }

  async isCameraAuthorized(cameraId) {
    const ref = this.db.collection('cameras').doc(cameraId);
    const doc = await ref.get();
    if (!doc.exists) return false;
    const camera = doc.data();
    return camera.isAuthorized !== false && camera.approvalStatus !== 'rejected';
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
