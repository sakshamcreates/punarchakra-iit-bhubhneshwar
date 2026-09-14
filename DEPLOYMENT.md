# ReValue — Deployment Guide

Architecture:

```
USER
  |
  v
NETLIFY (frontend/, static Vite build)
  |  calls VITE_API_BASE_URL
  v
RENDER — backend (backend/, Node.js/Express)
  |  calls ML_SERVICE_URL
  v
RENDER — ml-service (ml-service/, FastAPI + ONNX Runtime)
```

The frontend never talks to the ML service directly — it only calls the
backend, and the backend proxies ML requests. This was already the
project's design; nothing was changed to enforce it, only the URLs were
made configurable via environment variables.

---

## 1. Deploy the ML service (Render)

1. Render dashboard → **New +** → **Web Service** → connect this repo.
2. **Root Directory**: `ml-service`
3. **Runtime**: Python 3
4. **Build Command**: `pip install -r requirements.txt`
5. **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. **Instance Type**: Free is sufficient — the service no longer requires
   PyTorch/torchvision at runtime (ONNX Runtime only), so it fits well
   under the 512 MB limit.
7. **Health Check Path**: `/health`
8. No environment variables are required for this service to run.
9. Deploy, then copy the resulting URL, e.g.
   `https://revalue-ml-service.onrender.com`.

## 2. Deploy the backend (Render)

1. Render dashboard → **New +** → **Web Service** → same repo.
2. **Root Directory**: `backend`
3. **Runtime**: Node
4. **Build Command**: `npm install`
5. **Start Command**: `npm start`
6. **Health Check Path**: `/api/health`
7. **Environment Variables**:
   - `JWT_SECRET` — any strong random string (Render can auto-generate one)
   - `ML_SERVICE_URL` — the URL from step 1, e.g.
     `https://revalue-ml-service.onrender.com`
   - `FRONTEND_URL` — leave blank for now (you don't have the Netlify URL
     yet); you'll set it in step 4 and redeploy.
   - `PORT` — do not set this manually; Render injects it automatically
     and `app.js` already reads `process.env.PORT`.
8. Deploy, then copy the resulting URL, e.g.
   `https://revalue-backend.onrender.com`.

## 3. Deploy the frontend (Netlify)

1. Netlify dashboard → **Add new site** → **Import an existing project**
   → connect this repo.
2. If Netlify doesn't auto-detect `netlify.toml` at the repo root, set
   manually:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist` (relative to base) or `frontend/dist`
     (relative to repo root), depending on how Netlify's UI is asking.
3. **Site settings → Environment variables**:
   - `VITE_API_BASE_URL` = `https://revalue-backend.onrender.com/api`
     (the backend URL from step 2, **with `/api` and no trailing slash**)
   - `VITE_ENABLE_API_FALLBACK` = `true` (optional; existing app behavior)
4. Deploy, then copy the resulting URL, e.g.
   `https://revalue-app.netlify.app`.

## 4. Wire the frontend URL back into the backend (final connection step)

1. Go back to the Render backend service → **Environment**.
2. Set `FRONTEND_URL` to the Netlify URL from step 3, e.g.
   `https://revalue-app.netlify.app`.
   - You can pass multiple allowed origins as a comma-separated list,
     e.g. `https://revalue-app.netlify.app,https://deploy-preview--revalue-app.netlify.app`.
3. Trigger a redeploy (Render redeploys automatically on env var save in
   most plans; otherwise use **Manual Deploy**).

This closes the loop: Netlify → Render backend → Render ML service, with
the backend's CORS policy now scoped to your real frontend origin instead
of allowing any origin.

---

## Deployment order (summary)

1. ML service (Render) — no dependencies on the others.
2. Backend (Render) — needs the ML service URL from step 1.
3. Frontend (Netlify) — needs the backend URL from step 2.
4. Backend `FRONTEND_URL` update (Render) — needs the frontend URL from
   step 3, then redeploy.

This is a one-time "chicken and egg" sequence because Render/Netlify only
assign final URLs after first deploy. All later deploys (e.g. pushing new
commits) don't require repeating this — the env vars persist.

---

## Environment variables reference

| Variable | Where | Purpose | Example |
|---|---|---|---|
| `PORT` | Render (backend) | Port Express listens on | injected by Render automatically |
| `JWT_SECRET` | Render (backend) | Signs/verifies auth JWTs | random 32+ char string |
| `ML_SERVICE_URL` | Render (backend) | Backend → ML service base URL | `https://revalue-ml-service.onrender.com` |
| `FRONTEND_URL` | Render (backend) | Allowed CORS origin(s) | `https://revalue-app.netlify.app` |
| `VITE_API_BASE_URL` | Netlify (frontend, build-time) | Frontend → backend base URL (must include `/api`) | `https://revalue-backend.onrender.com/api` |
| `VITE_ENABLE_API_FALLBACK` | Netlify (frontend, build-time) | Falls back to bundled mock data if API unreachable (pre-existing behavior) | `true` |

Note: `VITE_*` variables are baked into the static JS bundle at **build
time**, not read at runtime. Changing them in Netlify requires a redeploy
to take effect.

---

## Local development (all three services together)

```bash
# Terminal 1 — ML service
cd ml-service
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 — backend
cd backend
cp .env.example .env            # defaults already point at ML service on :8000
npm install
npm run dev

# Terminal 3 — frontend
cd frontend
cp .env.example .env            # defaults already point at backend on :5000
npm install
npm run dev
```

Then open the Vite dev server URL (typically `http://localhost:5173`).

---

## Regenerating the ONNX model (only if you retrain)

The deployed ML service never needs PyTorch. But if you retrain the
classifier (`ml-service/training/train_scrap_classifier.py`, which still
uses PyTorch and produces a new `artifacts/scrap_classifier.pth`), re-export
it to ONNX before deploying:

```bash
cd ml-service
pip install torch torchvision onnx   # dev-only, not in requirements.txt
python scripts/convert_to_onnx.py
```

This overwrites `artifacts/scrap_classifier.onnx`. Commit the updated
`.onnx` file; the `.pth` file can stay local/dev-only.

---

## Known limitations / things not verified here

- **Live Render/Netlify deploys were not performed** — I don't have
  credentials for your Render/Netlify accounts. Everything above was
  verified **locally** (see README.md "Local verification performed" for
  the exact commands and results), simulating the same build/start
  commands and env-var wiring that Render/Netlify will run. The actual
  hosted URLs, TLS, and platform-specific quirks (e.g. Render free-tier
  cold starts/spin-down) have not been observed directly.
- **Render free tier cold starts**: both Render free services spin down
  after inactivity and take ~30–60s to wake on the next request. This is
  a platform characteristic, not a bug in this codebase — consider a paid
  tier or a keep-alive ping if that latency is unacceptable for a demo.
- **In-memory data store**: `backend/src/data/userRepository.js` (and
  the other repositories) store data in a plain in-memory array — this
  was already true before this change. That means all registered users,
  listings, etc. are wiped on every backend restart/redeploy on Render.
  This is out of scope for a deployment-wiring pass (would require adding
  a real database, which is a functional change, not a deployment fix),
  but you should know about it before treating this as production-ready
  for real users.
- **CORS default is permissive until `FRONTEND_URL` is set**: this
  matches the prior behavior (`origin: true`) exactly when the env var is
  left blank, so nothing breaks by default — but it does mean the API is
  open to any origin until you complete deployment step 4.
