import { store } from '../services/dataStore.js';
import { deleteStoredFile } from '../services/fileStorage.js';

export async function listRecordings(req, res) {
  const recordings = await store.listRecordings(200);
  res.json({ recordings });
}

export async function createRecording(req, res) {
  const recording = await store.createRecording(req.body);
  res.status(201).json({ recording });
}

export async function deleteRecording(req, res) {
  const recording = await store.deleteRecording(req.params.recordingId);
  await deleteStoredFile(recording.filePath);
  res.status(204).send();
}
