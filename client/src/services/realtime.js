import { io } from 'socket.io-client';
import { env } from '../config/env';

export function createRealtimeConnection() {
  return io(env.serverUrl, {
    reconnectionDelay: 1500,
  });
}
