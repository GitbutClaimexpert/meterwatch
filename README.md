# ⚡ MeterWatch — Cryptographically Verified Electricity Monitoring

A mobile-first PWA that captures tamper-proof meter readings, stores the original photos server-side with cryptographic proof, and automatically detects municipal overbilling from estimated readings.

---

## The Integrity Guarantee

Every meter photo goes through this pipeline — nothing is trusted until verified:

```
 PHONE CAMERA
      │  live capture only (no file upload route exists)
      ▼
 BACKEND (raw bytes arrive)
      │
      ├─► SHA-256 hash computed on raw bytes immediately
      │
      ├─► Duplicate check (same hash = replay attack → rejected)
      │
      ├─► Claude Vision validates:
      │     is it a real meter? screenshot? photo of a screen?
      │     digitally edited? photo of a printout?
      │     → CRITICAL flags = rejected, not saved
      │
      ├─► Original bytes written verbatim to disk
      │     filename = SHA-256 hash (self-describing)
      │
      ├─► Disk write verified by re-hashing from disk
      │     hash mismatch = write corruption → rejected
      │
      ├─► AI reads meter FROM THE SAVED FILE (not memory)
      │
      ├─► HMAC-signed proof record created:
      │     signs: user_id | server_ts | image_hash |
      │            reading_kwh | ai_reading | gps | prev_chain_hash
      │
      ├─► Hash chain updated:
      │     chain_hash = sha256(prev_hash:image_hash:reading:ts:user)
      │
      └─► Record inserted in DB (all fields immutable)

 VERIFICATION (anytime, by anyone with server secret):
      ├─► Re-hash image file on disk → must match image_hash in DB
      ├─► Re-compute HMAC from DB values → must match proof_hmac
      └─► Walk chain → each prev_chain_hash must match prior chain_hash
```

### What Each Layer Prevents

| Threat | Defence |
|--------|---------|
| Uploaded fake photo | No upload route for readings — camera only |
| Photo of a screen / screenshot | Claude Vision blocks it |
| Digitally edited photo | Claude Vision blocks it |
| Photo of a printed document | Claude Vision blocks it |
| Same photo resubmitted | `image_hash UNIQUE` → 409 rejected |
| Old stored photo submitted as new | Server timestamp vs client timestamp (3 min tolerance) |
| Reading value edited in DB | HMAC breaks on re-verification |
| Image file swapped on disk | SHA-256 of file vs stored hash mismatch |
| Reading deleted from history | Hash chain breaks at gap |
| Reading inserted into history | Hash chain breaks at insertion |
| Any DB field edited after save | HMAC verification fails |

### Verification API

```
GET /api/readings/:id/verify
```
Returns three independent checks:
1. **Image file integrity** — re-hashes the file, compares to DB
2. **HMAC proof** — re-computes signature from DB values, compares
3. **Hash chain continuity** — confirms no entry inserted/deleted

```
GET /api/verify/chain/:userId
```
Full audit of entire reading history — walks every entry in sequence.

---

## Project Structure

```
meterwatch/
├── frontend/               # React PWA
│   ├── src/App.jsx         # All 5 screens
│   ├── vite.config.js      # PWA manifest + service worker
│   └── package.json
│
├── backend/                # Express API
│   ├── src/index.js        # Full pipeline + crypto layer
│   ├── .env.example
│   └── package.json
│
└── data/                   # Created automatically at runtime
    ├── meterwatch.db       # SQLite (WAL mode)
    ├── images/             # Original meter photos (filename = SHA-256)
    ├── statements/         # Uploaded municipal bills
    └── .signing_secret     # HMAC key (600 permissions, owner-read only)
```

---

## Quick Start

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env — add ANTHROPIC_API_KEY
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # proxies /api to localhost:3001
```

---

## Environment Variables

### Backend (.env)
```
ANTHROPIC_API_KEY=sk-ant-api03-...    # Required
SIGNING_SECRET=<hex string>           # Optional — auto-generated if absent
FRONTEND_URL=https://your-app.com     # For CORS
PORT=3001
```

### Frontend (.env)
```
VITE_API_URL=https://your-backend.com
```

---

## Deployment

### Railway (recommended)
1. Push to GitHub
2. New project → Add service → connect repo → root: `backend`
3. Set `ANTHROPIC_API_KEY` secret
4. Add a Volume mounted at `/app/data` (persists SQLite + images)
5. Add second service for frontend → root: `frontend`
6. Set `VITE_API_URL` to backend URL

### Render + Vercel
**Backend on Render:**
- Build: `npm install` · Start: `npm start` · Root: `backend/`
- Add Disk at `/opt/render/project/data`
- Set env vars

**Frontend on Vercel:**
- Root: `frontend/` · Set `VITE_API_URL`

---

## Adding Real User Authentication

Current setup uses a random per-device user ID stored in localStorage. For production multi-user:

1. Add [Clerk](https://clerk.com) to the frontend
2. Pass JWT in `Authorization: Bearer <token>` header
3. Verify JWT in backend middleware, extract real user ID

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/readings/preview` | AI-extract reading preview (no DB write) |
| POST | `/api/readings/capture` | Full pipeline: validate → save → sign |
| GET  | `/api/readings` | All readings for user |
| GET  | `/api/readings/:id/verify` | Cryptographic verification of one reading |
| GET  | `/api/images/:filename` | Serve image with live integrity headers |
| POST | `/api/statements/upload` | Parse municipal bill with AI |
| GET  | `/api/statements` | All statements for user |
| POST | `/api/compare` | Discrepancy analysis + dispute letter |
| GET  | `/api/verify/chain/:userId` | Full chain audit (admin) |
| GET  | `/api/audit` | Audit event log |


