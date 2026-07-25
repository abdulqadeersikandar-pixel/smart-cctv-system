import { config } from './config/index.js';
import { createCloudConnection } from './cloud/socketClient.js';
import { trackCameraHealth } from './camera/health.js';

console.log(`🌉 Starting ${config.bridgeName}...`);

const { events } = createCloudConnection();

trackCameraHealth(events);

// Motion alerts land here. Recording capture isn't built yet (that's the
// next pass), so for now this just logs — once a recording file exists
// locally, this is where uploadToDrive() from src/storage gets called:
//
//   import { uploadToDrive } from './storage/googleDriveUploader.js';
//   events.on('motion-alert', async (alert) => {
//     await uploadToDrive(pathToClip, `${alert.node}-${alert.time}.mp4`);
//   });
events.on('motion-alert', (alert) => {
  console.log(`🚨 [${config.bridgeName}] Motion alert received:`, alert);
});
