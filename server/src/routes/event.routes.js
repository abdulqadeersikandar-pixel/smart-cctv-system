import { Router } from 'express';
import { createEvent, listEvents } from '../controllers/event.controller.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { validateEventCreate } from '../utils/validators.js';

const router = Router();

router.get('/', listEvents);
router.post('/', validateBody(validateEventCreate), createEvent);

export default router;
