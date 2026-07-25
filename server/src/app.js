import express from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config/env.js';
import { authMiddleware } from './middlewares/auth.middleware.js';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware.js';
import cameraRoutes from './routes/camera.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import eventRoutes from './routes/event.routes.js';
import recordingRoutes from './routes/recording.routes.js';

const app = express();
const allowedOrigins = env.clientOrigins;

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  })
);
app.use(express.json({ limit: '30mb' }));
app.use('/storage', express.static(path.resolve(process.cwd(), env.localStorageRoot)));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'active',
    message: 'Smart CCTV Cloud Server is running!',
    storageProvider: env.storageProvider,
    authRequired: env.requireAuth,
  });
});

app.use('/api', authMiddleware);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/recordings', recordingRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export { app, allowedOrigins };
