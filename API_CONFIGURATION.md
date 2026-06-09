# API Configuration for Live Deployment

This guide explains how the Project Estimation Calculator handles API connections for both local and live environments.

## Overview

The application automatically detects the environment and routes API calls accordingly:
- **Local Development (localhost)**: Calls `http://localhost:8000/api`
- **Live Server**: Calls `/api` on the same domain (reversed proxied to backend)

No manual code changes are required when moving between environments.

## Environment Detection

The frontend uses `frontend/src/config/apiConfig.js` to determine the API base URL:

```javascript
const isLocalhost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (isLocalhost
    ? 'http://localhost:8000/api'
    : `${window.location.origin}/api`)
```

**Priority:**
1. `VITE_API_BASE_URL` environment variable (if set in `.env` files)
2. Localhost detection: `http://localhost:8000/api`
3. Live server: `${window.location.origin}/api`

## Local Development

### 1. Start the Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs on: `http://localhost:8000`

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173` (or next available port)

### 3. Test Locally

1. Open browser console (F12)
2. Check the logs to verify API base URL:
   ```
   [API Config] isLocalhost: true
   [API Config] API_BASE_URL: http://localhost:8000/api
   ```
3. Test login and other API calls
4. All requests should go to `http://localhost:8000/api/*`

### 4. Environment Variables (Optional)

You can create `.env.development` to override settings:

```bash
# frontend/.env.development
VITE_API_BASE_URL=http://localhost:8000/api
```

But this is **optional**. The automatic detection works by default.

## Live Server Deployment

### 1. Backend Setup

Run the backend on the server, typically on a local port (not exposed):

```bash
# Example: Run on localhost:8000 (not exposed to internet)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Or use systemd service to auto-restart:

```bash
# /etc/systemd/system/estimation-api.service
[Unit]
Description=Project Estimation Calculator API
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/project-estimation-calculator/backend
Environment="PATH=/var/www/project-estimation-calculator/backend/.venv/bin"
ExecStart=/var/www/project-estimation-calculator/backend/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

[Install]
WantedBy=multi-user.target
```

### 2. Frontend Build

Build the frontend production bundle:

```bash
cd frontend
npm run build
```

This generates `frontend/dist/` with optimized files.

The build automatically uses:
- `.env.production` if it exists
- Or falls back to automatic detection

### 3. Nginx Reverse Proxy Configuration

Configure Nginx to:
1. Serve the static frontend
2. Proxy `/api` requests to the backend

```nginx
# /etc/nginx/sites-available/estimation-calculator
server {
    listen 80;
    listen [::]:80;
    server_name estimation-calculator.mydevfactory.com;

    # Redirect HTTP to HTTPS (recommended for production)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name estimation-calculator.mydevfactory.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/estimation-calculator.mydevfactory.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/estimation-calculator.mydevfactory.com/privkey.pem;

    # Frontend static files
    root /var/www/project-estimation-calculator/frontend/dist;
    index index.html;

    # Serve static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_set_header X-Forwarded-Port $server_port;

        # WebSocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # SPA routing: fallback to index.html for unmatched routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
```

### 4. Enable Nginx Site

```bash
sudo ln -s /etc/nginx/sites-available/estimation-calculator /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Test Live Deployment

1. Open `https://estimation-calculator.mydevfactory.com` in browser
2. Open browser console (F12)
3. Verify API logs show:
   ```
   [API Config] isLocalhost: false
   [API Config] API_BASE_URL: https://estimation-calculator.mydevfactory.com/api
   ```
4. Test login and other API calls
5. All requests should go to `/api/*` (proxied to `http://127.0.0.1:8000/api/`)

## Backend CORS Configuration

The backend automatically enables CORS for all configured domains:

```python
# backend/app/main.py
CORS_ORIGINS = [
    "http://localhost:5173",      # Local dev
    "http://127.0.0.1:5173",      # Local dev (IP)
    "http://localhost:3000",      # Alternative port
    # ... etc
]

# Production domain (from environment or default)
PRODUCTION_DOMAIN = os.getenv("PRODUCTION_DOMAIN", "https://estimation-calculator.mydevfactory.com")
if os.getenv("ENVIRONMENT") == "production":
    CORS_ORIGINS.append(PRODUCTION_DOMAIN)
```

### Production Environment Variables

Set on the server:

```bash
export ENVIRONMENT=production
export PRODUCTION_DOMAIN=https://estimation-calculator.mydevfactory.com
```

Or add to systemd service file:

```ini
[Service]
Environment="ENVIRONMENT=production"
Environment="PRODUCTION_DOMAIN=https://estimation-calculator.mydevfactory.com"
```

## API Endpoints

### Health Check

- **Local**: `http://localhost:8000/api/health`
- **Live**: `https://estimation-calculator.mydevfactory.com/api/health`

Response:
```json
{
  "status": "healthy",
  "version": "2.0",
  "mode": "fixed-cost-estimation"
}
```

### Authentication

- **Login**: `POST /api/auth/login`
- **Signup**: `POST /api/auth/signup`
- **Me**: `GET /api/auth/me`

### Estimates

- **Create**: `POST /api/estimates`
- **List**: `GET /api/estimates`
- **Get**: `GET /api/estimates/{id}`
- **Update**: `PUT /api/estimates/{id}`
- **Delete**: `DELETE /api/estimates/{id}`

### Admin

- **Dashboard**: `GET /api/admin/dashboard`
- **Users**: `GET /api/admin/users`
- **Estimates**: `GET /api/admin/estimates`

## Troubleshooting

### 1. "Cannot connect to server" Error

**Symptom**: Frontend shows network errors

**Solutions**:
1. Verify backend is running: `curl http://localhost:8000/api/health`
2. Check CORS configuration in `backend/app/main.py`
3. Check Nginx reverse proxy is forwarding `/api` correctly
4. Check browser console for actual API URL being called

### 2. API URL Is Wrong

**Symptom**: Browser console shows wrong API URL

**Solutions**:
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Check `.env` files are correct
4. Check `window.location.hostname` is correct
5. Ensure frontend was rebuilt for production: `npm run build`

### 3. CORS Errors

**Symptom**: Browser console shows CORS policy error

**Solutions**:
1. Add your domain to `CORS_ORIGINS` in `backend/app/main.py`
2. Restart backend: `systemctl restart estimation-api`
3. Verify `allow_credentials=True` is set in CORS middleware

### 4. Files Not Downloading

**Symptom**: File download links don't work

**Solutions**:
1. Verify file URL format: should be `/api/files/{id}`
2. Check file exists in database
3. Verify backend file upload directory has proper permissions
4. Check Nginx reverse proxy allows file downloads

## Environment-Specific .env Files

### .env.development
```bash
# Explicitly set API for local development
VITE_API_BASE_URL=http://localhost:8000/api
```

### .env.production
```bash
# For production (but /api relative path is usually better)
# VITE_API_BASE_URL=https://estimation-calculator.mydevfactory.com/api
# Or leave empty to use automatic detection
```

## Summary

| Environment | Frontend URL | Backend URL | API Calls To |
|-------------|--------------|-------------|--------------|
| Local Dev | http://localhost:5173 | http://localhost:8000 | http://localhost:8000/api |
| Live | https://estimation-calculator.mydevfactory.com | http://127.0.0.1:8000 (internal) | /api (proxied) |

The frontend automatically detects which environment it's running in and routes API calls accordingly. **No code changes needed.**
