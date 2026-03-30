 MedSee.ai MVP

This repository now contains a working Phase 1 and Phase 2 MVP for a medical imaging analysis platform.

## What is implemented

### Frontend
- Upload page for JPEG and PNG scans
- Drag and drop file selection
- Client-side validation for file type and 50MB size limit
- Preview before upload
- Upload progress state
- Dashboard view after upload
- Modern responsive UI inspired by the provided design direction
- Report panel with generated sections
- Measurements panel
- AI assistant summary panel
- Findings list with confidence and severity
- Export report as a text file
- Canvas viewer with:
  - image rendering
  - detection overlays
  - zoom controls
  - pan by dragging
  - reset view

### Backend
- Express server
- `POST /api/upload` for image upload
- `POST /api/detect` for mock AI detection
- `GET /api/health` health check
- Static serving for uploaded files from `/uploads`
- File validation for JPEG/PNG only
- 50MB upload limit
- In-memory case storage for uploaded studies
- Mock analysis payload with:
  - detections
  - summary
  - assistant guidance
  - report sections
  - measurements

## Project structure

```text
client/mitsee_frontend  Vite + TypeScript frontend
server                  Express backend
```

## How to run

### Backend

```bash
cd server
npm install
npm run start
```

Server runs on `http://localhost:5000`

### Frontend

```bash
cd client/mitsee_frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

## How to test

1. Start backend and frontend.
2. Open the frontend in the browser.
3. Upload a `.jpg` or `.png` file.
4. Confirm preview appears before upload.
5. Click `Upload & Analyze`.
6. Review the dashboard output.
7. Test zoom, pan, findings hover/select, and export report.

## Verification completed

- Frontend production build passes with `npm run build`
- Backend syntax check passes with `npm test`
- Backend starts successfully on port `5000`

## Git

The MVP implementation was committed and pushed to GitHub on `main`.
