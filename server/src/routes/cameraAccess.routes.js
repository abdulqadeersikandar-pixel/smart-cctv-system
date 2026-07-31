import { Router } from 'express';
import {
  createCameraInviteCode,
  getCameraAccessRequestStatus,
  listPendingCameraRequests,
  requestCameraAccess,
  reviewCameraRequest,
} from '../controllers/cameraAccess.controller.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import {
  validateCameraAccessRequest,
  validateCameraInviteCreate,
  validateCameraRequestReview,
} from '../utils/validators.js';

const publicRouter = Router();
const protectedRouter = Router();

publicRouter.post('/request', validateBody(validateCameraAccessRequest), requestCameraAccess);
publicRouter.get('/request-status', getCameraAccessRequestStatus);

protectedRouter.post('/invite-codes', validateBody(validateCameraInviteCreate), createCameraInviteCode);
protectedRouter.get('/requests', listPendingCameraRequests);
protectedRouter.post(
  '/requests/:requestId/review',
  validateBody(validateCameraRequestReview),
  reviewCameraRequest
);

export { publicRouter as cameraAccessPublicRoutes, protectedRouter as cameraAccessProtectedRoutes };
