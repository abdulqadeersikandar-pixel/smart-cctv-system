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
import { cameraAccessProtectedRoutes, cameraAccessPublicRoutes } from './routes/cameraAccess.routes.js';

const app = express();
const allowedOrigins = env.clientOrigins;

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret'],
    optionsSuccessStatus: 204,
  })
);
app.use(express.json({ limit: '30mb' }));
app.use('/storage', express.static(path.resolve(process.cwd(), env.localStorageRoot)));
app.use('/recordings', express.static(path.resolve(process.cwd(), env.localStorageRoot, 'recordings')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'active',
    message: 'Smart CCTV Cloud Server is running!',
    storageProvider: env.storageProvider,
    authRequired: env.requireAuth,
  });
});

app.get('/api/webrtc/config', (req, res) => {
  res.json({ iceServers: env.iceServers || [] });
});

app.use('/api/camera-access', cameraAccessPublicRoutes);

app.use('/api', authMiddleware);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/recordings', recordingRoutes);
app.use('/api/camera-access', cameraAccessProtectedRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export { app, allowedOrigins };
