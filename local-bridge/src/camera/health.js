/**
 * Tracks which camera nodes are currently online, based on 'camera-status'
 * broadcasts relayed from the cloud server's socket registry.
 *
 * This is deliberately source-agnostic: it doesn't care whether a camera is
 * the J3 Pro (phone browser), a USB webcam opened in a laptop browser tab,
 * or — later — an IP/RTSP camera captured by a module added here. Every
 * source registers with the same {id, name, role: 'camera'} shape, so this
 * file never needs to change when the camera hardware changes.
 */
let knownCameras = [];

export function trackCameraHealth(events) {
  events.on('camera-status', (cameras) => {
    knownCameras = cameras;
    console.log(
      `📷 Cameras online: ${cameras.length ? cameras.map((c) => c.name).join(', ') : 'none'}`
    );
  });
}

export function getKnownCameras() {
  return knownCameras;
}

/*
 * Future extension point for non-browser sources (USB webcam attached
 * directly to this laptop without a browser tab open, or a Wi-Fi/IP
 * camera's RTSP stream). A capture adapter would live here and would:
 *   1. Pull frames via ffmpeg (spawn a child process reading the
 *      RTSP/USB device).
 *   2. Feed them into a Node-side WebRTC peer (e.g. the `werift` or
 *      `wrtc` package) so the stream joins the same signaling flow
 *      CameraStream.jsx already uses.
 *   3. Call the same register()/motion-alert emit shape used by the
 *      browser page, so the server/dashboard need zero changes.
 */
