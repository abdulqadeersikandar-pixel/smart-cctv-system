import { Router } from 'express';
import {
  createRecording,
  deleteRecording,
  downloadRecording,
  listRecordings,
} from '../controllers/recording.controller.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { validateRecordingCreate } from '../utils/validators.js';

const router = Router();

router.get('/', listRecordings);
router.get('/:recordingId/download', downloadRecording);
router.post('/', validateBody(validateRecordingCreate), createRecording);
router.delete('/:recordingId', deleteRecording);

export default router;
