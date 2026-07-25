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
