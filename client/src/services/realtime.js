import { io } from 'socket.io-client';
import { env } from '../config/env';

export function createRealtimeConnection() {
  return io(env.serverUrl, {
    transports: ['websocket', 'polling'],
    timeout: 20000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 5000,
  });
}
