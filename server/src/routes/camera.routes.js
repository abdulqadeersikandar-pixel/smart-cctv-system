import { Router } from 'express';
import {
  listCameras,
  createCamera,
  updateCamera,
  deleteCamera,
} from '../controllers/camera.controller.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { validateCameraCreate, validateCameraUpdate } from '../utils/validators.js';

const router = Router();

router.get('/', listCameras);
router.post('/', validateBody(validateCameraCreate), createCamera);
router.patch('/:cameraId', validateBody(validateCameraUpdate), updateCamera);
router.delete('/:cameraId', deleteCamera);

export default router;
