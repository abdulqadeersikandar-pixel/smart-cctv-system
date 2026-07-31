const SOURCE_TYPES = new Set(['phone', 'usb', 'ip']);
const EVENT_TYPES = new Set(['motion', 'system', 'health']);
const RECORDING_TRIGGERS = new Set(['manual', 'motion']);

function isString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateCameraCreate(body) {
  const errors = [];
  if (!isString(body.name)) errors.push('Camera name is required.');
  if (!SOURCE_TYPES.has(body.sourceType)) {
    errors.push("Camera sourceType must be one of: 'phone', 'usb', 'ip'.");
  }
  if (body.sourceUrl !== undefined && typeof body.sourceUrl !== 'string') {
    errors.push('Camera sourceUrl must be a string.');
  }
  return errors;
}

export function validateCameraUpdate(body) {
  const errors = [];
  if (body.name !== undefined && !isString(body.name)) {
    errors.push('Camera name must be a non-empty string.');
  }
  if (body.sourceType !== undefined && !SOURCE_TYPES.has(body.sourceType)) {
    errors.push("Camera sourceType must be one of: 'phone', 'usb', 'ip'.");
  }
  if (body.sourceUrl !== undefined && typeof body.sourceUrl !== 'string') {
    errors.push('Camera sourceUrl must be a string.');
  }
  return errors;
}

export function validateEventCreate(body) {
  const errors = [];
  if (!EVENT_TYPES.has(body.type)) errors.push("Event type must be one of: 'motion', 'system', 'health'.");
  if (!isString(body.cameraId)) errors.push('Event cameraId is required.');
  if (!isString(body.cameraName)) errors.push('Event cameraName is required.');
  if (!isString(body.message)) errors.push('Event message is required.');
  return errors;
}

export function validateRecordingCreate(body) {
  const errors = [];
  if (!isString(body.cameraId)) errors.push('Recording cameraId is required.');
  if (!isString(body.cameraName)) errors.push('Recording cameraName is required.');
  if (!RECORDING_TRIGGERS.has(body.trigger)) {
    errors.push("Recording trigger must be 'manual' or 'motion'.");
  }
  if (!isString(body.filePath)) errors.push('Recording filePath is required.');
  return errors;
}

export function validateCameraInviteCreate(body) {
  const errors = [];
  if (body.expiresInMinutes !== undefined) {
    const value = Number(body.expiresInMinutes);
    if (!Number.isInteger(value) || value < 1 || value > 1440) {
      errors.push('expiresInMinutes must be an integer between 1 and 1440.');
    }
  }
  return errors;
}

export function validateCameraAccessRequest(body) {
  const errors = [];
  if (!isString(body.cameraId)) errors.push('cameraId is required.');
  if (!isString(body.cameraName)) errors.push('cameraName is required.');
  if (!SOURCE_TYPES.has(body.sourceType)) {
    errors.push("sourceType must be one of: 'phone', 'usb', 'ip'.");
  }
  if (!isString(body.inviteCode)) errors.push('inviteCode is required.');
  if (body.sourceUrl !== undefined && typeof body.sourceUrl !== 'string') {
    errors.push('sourceUrl must be a string.');
  }
  return errors;
}

export function validateCameraRequestReview(body) {
  const errors = [];
  if (!isString(body.action)) {
    errors.push("action is required and must be 'approve' or 'reject'.");
    return errors;
  }
  if (!['approve', 'reject'].includes(body.action.trim().toLowerCase())) {
    errors.push("action must be 'approve' or 'reject'.");
  }
  if (body.action?.trim().toLowerCase() === 'reject' && !isString(body.reason)) {
    errors.push('reason is required when rejecting a camera request.');
  }
  return errors;
}
