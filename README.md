# 📹 Smart CCTV Surveillance System

<p align="center">
  <img src="https://img.shields.io/badge/status-production--ready-brightgreen?style=for-the-badge" alt="status"/>
  <img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="license"/>
  <img src="https://img.shields.io/badge/build-passing-success?style=for-the-badge" alt="build"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React"/>
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.IO"/>
  <img src="https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white" alt="WebRTC"/>
  <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase"/>
  <img src="https://img.shields.io/badge/Google_Drive_API-4285F4?style=for-the-badge&logo=googledrive&logoColor=white" alt="Google Drive API"/>
  <img src="https://img.shields.io/badge/Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white" alt="Netlify"/>
  <img src="https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white" alt="Render"/>
</p>

<p align="center">
  <b>A production-grade, real-time surveillance platform built from scratch —
  multi-camera streaming, cloud-synced recordings, motion detection, and a professional monitoring dashboard.</b>
</p>

---

## 🧭 Overview

**Smart CCTV Surveillance System** turns any phone, laptop, or (soon) USB/IP camera into a live-streaming surveillance node, viewable from a centralized web dashboard in real time. It was built as a full production system — not a tutorial clone — covering everything a real deployment needs: stable WebRTC streaming, automatic reconnection, cloud backup, retention policies, and multi-camera management.

> Built end-to-end as a solo full-stack + systems engineering project — signaling, media pipelines, cloud storage sync, and state architecture all designed and implemented from the ground up.

---

## ✨ Key Features

### 🔴 Real-Time Live Streaming
- WebRTC peer-to-peer video streaming with a Socket.IO signaling server
- Stable playback across devices and external displays (LCD/TV, multiple screens)
- Automatic reconnection and stream recovery on network drops
- Optimized signaling flow to reduce latency and dropped frames

### ☁️ Cloud Storage Integration (Google Drive)
- Automatic upload of manual and motion-triggered recordings
- Recordings organized by **Camera → Date → Time**
- Real-time upload status shown directly in the dashboard
- Local and cloud storage kept in sync

### 🗓️ Automated 30-Day Retention Policy
- Scheduled cleanup jobs (cron-based) purge recordings older than 30 days
- Cloud files and database metadata removed together — no orphaned records
- Recent recordings are always protected from deletion

### 📷 Multi-Camera Support
- Multiple phones can act as simultaneous camera sources
- Architecture ready for USB and IP camera integration
- Dashboard views: **Grid View**, **Single Camera View**, **Full Screen**
- Instant camera switching
- Per-camera live status: online/offline, last seen, recording state, motion status, camera name

### 🧠 Motion Detection
- Real-time motion detection triggers automatic recording
- Motion events logged and tied to their respective camera and timestamp

### 🔐 Authentication & Access Control
- Firebase Authentication for secure login
- Protected routes across the dashboard

### ⚛️ Scalable Frontend Architecture
- Centralized state management for Auth, Cameras, Dashboard, Alerts, Live Streams, Recordings, and Settings
- Prop-drilling eliminated via reusable hooks and services
- Performance-optimized rendering for multi-camera views

### 📥 Reliable Recording Downloads
- Download recordings from local storage or Google Drive
- Original filenames and timestamps preserved
- Graceful handling of missing/unavailable files

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Real-Time Communication | WebRTC, Socket.IO |
| Authentication | Firebase Authentication |
| Database | Firestore |
| Cloud Storage | Google Drive API |
| Scheduled Jobs | Node-cron (automated retention cleanup) |
| Frontend Hosting | Netlify |
| Backend Hosting | Render |

---

## 📂 Project Structure

```
smart-cctv-surveillance/
├── client/                        # React + Vite frontend
│   ├── src/
│   │   ├── components/            # Reusable UI components
│   │   ├── pages/                 # Dashboard, Login, CameraStream, etc.
│   │   ├── context/                # Centralized state (Auth, Cameras, Alerts...)
│   │   ├── hooks/                  # Custom reusable hooks
│   │   ├── services/                # API & Firebase service layers
│   │   └── utils/                    # Helper functions
│   └── vite.config.js
│
├── server/                        # Node.js + Express backend
│   ├── controllers/               # Route logic (cameras, recordings, auth)
│   ├── routes/                    # Express route definitions
│   ├── models/                    # Firestore data models
│   ├── middlewares/               # Auth guards, error handling
│   ├── services/
│   │   ├── driveService.js        # Google Drive upload/sync logic
│   │   ├── retentionJob.js        # 30-day cleanup cron job
│   │   └── signalingService.js    # WebRTC/Socket.IO signaling
│   ├── config/                    # Firebase & Drive API configs
│   └── server.js
│
├── local-bridge/                  # Local device/camera bridge layer
│
└── README.md
```

---

## ⚙️ How It Works

1. **Camera Registration** — A device (phone/browser) connects via WebRTC and registers itself as a live camera node with the signaling server.
2. **Signaling & Streaming** — Socket.IO exchanges SDP/ICE candidates between camera and viewer; WebRTC establishes a direct peer-to-peer stream. On disconnect, the client auto-attempts reconnection.
3. **Motion Detection & Recording** — The camera stream is analyzed for motion; on detection, a recording is triggered and saved locally.
4. **Cloud Sync** — Recordings are automatically uploaded to Google Drive under a `Camera/Date/Time` folder structure, with live upload status reflected in the dashboard.
5. **Retention Cleanup** — A scheduled job runs daily, scanning recording metadata and deleting any file (local, cloud, and database entry) older than 30 days.
6. **Dashboard** — Centralized state management renders all connected cameras in Grid, Single, or Full Screen view, with live status indicators per camera.

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/<your-username>/smart-cctv-surveillance.git

# Install frontend dependencies
cd client && npm install

# Install backend dependencies
cd ../server && npm install

# Configure environment variables
cp .env.example .env
# Add Firebase config, Google Drive API credentials, and server URLs

# Run backend
npm run dev

# Run frontend (in a separate terminal)
cd ../client && npm run dev
```

---

## 🗺️ Roadmap

- [ ] USB camera support
- [ ] IP camera (RTSP) integration
- [ ] AI-based person/object/vehicle detection
- [ ] Night vision support
- [ ] Multi-user access & camera sharing
- [ ] Mobile companion app
- [ ] AI analytics dashboard

---

## 👤 Author

**Abdul Qadeer Sikandar**
Full-Stack Developer | Software Engineering Student, University of Gujrat
Building AI-powered, production-grade web systems.

---

## 📄 License

This project is licensed under the MIT License.
