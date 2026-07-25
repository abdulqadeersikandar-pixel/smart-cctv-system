# Smart CCTV Surveillance System

AI-powered full-stack CCTV system — live streaming, motion detection, and
remote monitoring, built to scale from a phone camera to USB/IP cameras
without rearchitecting.

## Current implementation snapshot

This project now includes:

- Full backend REST structure (`controllers`, `routes`, `middlewares`, `services`, `config`, `utils`)
- Camera CRUD, events history, dashboard summary, recordings APIs
- Optional Firebase Admin token verification on API routes
- Local storage/JSON persistence by default, Firestore mode support
- Socket.IO signaling upgraded for camera/viewer registration and selected-camera viewing
- Motion alert ingestion with screenshot persistence
- Motion/manual recording upload flow from camera node page
- Frontend reusable hooks/services (`useDashboardData`, `useViewerStream`, API client, auth hook)
- Professional dashboard cards for status, alerts, recordings, storage, and live controls

## Structure

```
smart-cctv-system/
├── client/          # React + Vite + Tailwind (Vercel)
├── server/          # Node + Express + Socket.IO signaling (Render)
└── local-bridge/     # (not yet built) local script tying a camera source into the cloud
```

## Status as of this pass — bug fixes + missing configs

These were fixed so the project actually installs, builds, and runs:

1. **`client/src/pages/login.jsx` → `Login.jsx`**
   `App.jsx` imports `./pages/Login` (capital L). The file was lowercase —
   worked on Windows, would have **failed the Vercel build** (Linux is
   case-sensitive).
2. **Duplicate server entry points removed.**
   There was a working `server/server.js` at the root *and* a near-duplicate
   `server/src/server.js`, with an empty `server/src/app.js`. Consolidated to
   the intended structure:
   - `server/src/app.js` — Express app, CORS, middleware, health route
   - `server/src/server.js` — creates the HTTP server, attaches Socket.IO
     (WebRTC signaling), starts listening
   - `server/package.json` now points `main`/`start`/`dev` at `src/server.js`
3. **Added `client/vite.config.js`** — was missing entirely; without it the
   React plugin never loads.
4. **Added `client/postcss.config.js`** — `@tailwindcss/postcss` was already
   a dependency but had no config wiring it up, so the Tailwind v4 build
   would fail.
5. **Added `.env.example` for both `client/` and `server/`** and a root
   `.gitignore` (`node_modules`, `.env`, `dist`, etc. were not ignored
   anywhere in the zip).

Verified locally: `npm install && npm run build` succeeds in `client/`,
and `npm install && node src/server.js` in `server/` starts and responds
on `/api/health`.

## Running locally

```bash
# Terminal 1 — backend
cd server
cp .env.example .env      # fill in Firebase Admin values later
npm install
npm run dev

# Terminal 2 — frontend
cd client
cp .env.example .env      # fill in your Firebase web app config
npm install
npm run dev
```

Open `http://localhost:5173/stream` on the Samsung J3 Pro (same network) to
act as the camera, and `http://localhost:5173/dashboard` (after logging in)
to view the feed.

## Pass 2 — local-bridge (camera presence, health, motion relay)

**Architecture decision:** the J3 Pro already streams by opening
`CameraStream.jsx` in its own mobile browser — it's its own WebRTC peer,
using `getUserMedia`. That means `local-bridge` doesn't need to touch the
video feed for this camera at all. It runs on the HP laptop and handles the
things a browser tab can't:

- Registers with the cloud server as a `bridge` node (same registry
  cameras/viewers use)
- Tracks which cameras are online/offline (`src/camera/health.js`) —
  source-agnostic, so a future USB webcam (opened via the exact same
  `CameraStream.jsx` page, just picking a different device in
  `getUserMedia`) or IP camera needs zero changes here
- Receives `motion-alert` events relayed from any camera
  (`src/cloud/socketClient.js`)
- Has a working Google Drive uploader (`src/storage/googleDriveUploader.js`)
  ready for once recordings exist locally — needs a service account JSON
  + folder ID in `.env` to actually upload

Also fixed while building this:
- **`motion-alert` had no server-side listener at all** — `CameraStream.jsx`
  was emitting it into the void. Server now relays it to all viewers/bridges
  and logs it.
- Added a `register` handshake + in-memory `nodeRegistry.js` service so the
  server tracks camera online/offline state and broadcasts `camera-status`.
  `CameraStream.jsx` and `Dashboard.jsx` now identify themselves on connect.

Verified end-to-end locally: started the server + local-bridge, simulated a
camera connecting/registering/sending a motion alert — bridge correctly
logged "Cameras online: Test Camera" and received the alert, then "Cameras
online: none" on disconnect.

### Running all three pieces

```bash
# Terminal 1 — cloud server
cd server && npm install && npm run dev

# Terminal 2 — local-bridge (run on the laptop)
cd local-bridge
cp .env.example .env
npm install
npm run dev

# Terminal 3 — frontend
cd client && npm install && npm run dev
```

## Still missing (next passes)

- Recording (manual + motion-triggered) — nothing writes a video file
  locally yet, so the Drive uploader has nothing to upload
- IP/RTSP camera capture adapter inside `local-bridge/src/camera/` (noted
  as an extension point in `health.js`)
- Firestore / Firebase Admin wiring, camera CRUD, event history, storage
  usage stats
- `hooks/`, `utils/`, `middlewares/`, `routes/`, `controllers/`, `config/` —
  still empty/non-existent on the client and mostly on the server
