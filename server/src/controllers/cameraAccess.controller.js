import { env } from '../config/env.js';
import { store } from '../services/dataStore.js';
import { HttpError } from '../utils/httpError.js';

function generateInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function isInviteExpired(invite) {
  return new Date(invite.expiresAt).getTime() <= Date.now();
}

export async function createCameraInviteCode(req, res) {
  const expiresInMinutes = Number(req.body.expiresInMinutes || env.cameraInviteCodeExpiryMinutes);
  let code = generateInviteCode();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await store.getCameraInviteCode(code);
    if (!existing || existing.usedAt || isInviteExpired(existing)) break;
    code = generateInviteCode();
  }

  const created = await store.createCameraInviteCode({
    code,
    createdBy: req.user?.email || '',
    expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
  });

  res.status(201).json({ inviteCode: created });
}

export async function requestCameraAccess(req, res) {
  const payload = req.body;
  const invite = await store.getCameraInviteCode(payload.inviteCode);
  if (!invite) throw new HttpError(404, 'Invite code not found.');
  if (invite.usedAt) throw new HttpError(400, 'Invite code already used.');
  if (isInviteExpired(invite)) throw new HttpError(400, 'Invite code expired.');

  const existing = await store.getLatestCameraRequestByCameraId(payload.cameraId);
  if (existing && existing.status === 'pending') {
    res.status(202).json({ cameraRequest: existing, message: 'Request already pending admin approval.' });
    return;
  }

  await store.consumeCameraInviteCode(payload.inviteCode, payload.cameraId);
  const request = await store.createCameraRequest(payload);
  const approvedRequest = await store.updateCameraRequestStatus(request.id, {
    status: 'approved',
    reviewedBy: 'pin-verification',
  });
  const camera = await store.upsertApprovedCameraFromRequest(approvedRequest);
  await store.createEvent({
    type: 'system',
    cameraId: payload.cameraId,
    cameraName: payload.cameraName,
    message: 'Camera linked successfully with invite PIN.',
    severity: 'info',
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ cameraRequest: approvedRequest, camera });
}

export async function getCameraAccessRequestStatus(req, res) {
  const requestId = String(req.query.requestId || '').trim();
  if (!requestId) throw new HttpError(400, 'requestId is required.');

  const request = await store.getCameraRequest(requestId);
  if (!request) throw new HttpError(404, 'Camera request not found.');
  res.json({ cameraRequest: request });
}

export async function listPendingCameraRequests(req, res) {
  const requests = await store.listPendingCameraRequests();
  res.json({ requests });
}

export async function reviewCameraRequest(req, res) {
  const action = String(req.body.action || '').trim().toLowerCase();
  const request = await store.getCameraRequest(req.params.requestId);
  if (!request) throw new HttpError(404, 'Camera request not found.');
  if (request.status !== 'pending') {
    throw new HttpError(409, `Camera request is already ${request.status}.`);
  }

  if (action === 'approve') {
    const updatedRequest = await store.updateCameraRequestStatus(req.params.requestId, {
      status: 'approved',
      reviewedBy: req.user?.email || '',
    });
    const camera = await store.upsertApprovedCameraFromRequest(updatedRequest);
    await store.createEvent({
      type: 'system',
      cameraId: updatedRequest.cameraId,
      cameraName: updatedRequest.cameraName,
      message: 'Camera request approved by admin.',
      severity: 'info',
      createdAt: new Date().toISOString(),
    });
    res.json({ cameraRequest: updatedRequest, camera });
    return;
  }

  const updatedRequest = await store.updateCameraRequestStatus(req.params.requestId, {
    status: 'rejected',
    reviewedBy: req.user?.email || '',
    rejectionReason: req.body.reason || '',
  });
  await store.createEvent({
    type: 'system',
    cameraId: updatedRequest.cameraId,
    cameraName: updatedRequest.cameraName,
    message: `Camera request rejected by admin. ${updatedRequest.rejectionReason}`.trim(),
    severity: 'info',
    createdAt: new Date().toISOString(),
  });

  res.json({ cameraRequest: updatedRequest });
}
