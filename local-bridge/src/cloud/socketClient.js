import { io } from 'socket.io-client';
import { EventEmitter } from 'events';
import { config } from '../config/index.js';

/**
 * Wraps the Socket.IO connection to the cloud server. The bridge registers
 * itself as a 'bridge' node (same registry the cameras/viewers use), then
 * re-emits the events other local-bridge modules care about — so
 * camera/health.js and storage/* never touch socket.io-client directly.
 */
export function createCloudConnection() {
  const emitter = new EventEmitter();
  const socket = io(config.cloudServerUrl, {
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log(`🟢 Bridge connected to cloud server (${config.cloudServerUrl})`);
    socket.emit('register', {
      id: config.bridgeName,
      name: config.bridgeName,
      role: 'bridge',
    });
    emitter.emit('connected');
  });

  socket.on('disconnect', () => {
    console.log('🔴 Bridge disconnected from cloud server');
    emitter.emit('disconnected');
  });

  // Cameras going online/offline — this is what src/camera/health.js tracks
  socket.on('camera-status', ({ cameras }) => {
    emitter.emit('camera-status', cameras);
  });

  // Motion events from any camera node — this is what will trigger
  // recording + Drive upload once storage/googleDriveUploader.js is wired up
  socket.on('motion-alert', (alert) => {
    emitter.emit('motion-alert', alert);
  });

  socket.on('connect_error', (err) => {
    console.error('⚠️  Could not reach cloud server:', err.message);
  });

  return { socket, events: emitter };
}
