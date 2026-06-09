# API Connection Fix - Implementation Summary

## Overview
Fixed the Project Estimation Calculator so the frontend works on both localhost and live server without manual code changes. All API connections are now environment-aware and automatically route to the correct backend.

## Files Changed

### 1. Frontend Configuration (NEW)
- **`frontend/src/config/apiConfig.js`** - NEW
  - Centralized API configuration file
  - Detects environment (localhost vs. live)
  - Automatically selects correct API base URL
  - Exports `API_BASE_URL` and `getAuthHeaders()` functions
  - Logs API config for debugging

### 2. Frontend Services (UPDATED)
- **`frontend/src/services/api.js`** - MODIFIED
  - Now imports `API_BASE_URL` from `apiConfig.js`
  - Removed hardcoded `http://localhost:8000/api`
  - Enhanced error handling with better network error detection
  - Logs API errors for debugging

- **`frontend/src/api.js`** - MODIFIED
  - Removed hardcoded localhost URL
  - Now imports `API_BASE_URL` from `apiConfig.js`
  - Maintains backward compatibility

- **`frontend/src/App.jsx`** - MODIFIED
  - Imported `API_BASE_URL` from `apiConfig.js`
  - Created `toAbsoluteFileUrl()` helper function
  - Fixed hardcoded `http://localhost:8000` in file URLs
  - File URLs now work on both localhost and live server

- **`frontend/src/components/admin/AdminEstimateDetails.jsx`** - MODIFIED
  - Updated `toAbsoluteUrl()` function to use `API_BASE_URL`
  - Removed hardcoded localhost URL

### 3. Frontend Environment Files (NEW)
- **`frontend/.env.development`** - NEW
  - Explicit API URL for local development
  - Set to `http://localhost:8000/api`

- **`frontend/.env.production`** - NEW
  - API URL for production (relative path)
  - Set to `/api` (proxied by reverse proxy)
  - Can be overridden by environment variable

### 4. Backend (UPDATED)
- **`backend/app/main.py`** - MODIFIED
  - Updated CORS configuration to support live domain
  - Added `PRODUCTION_DOMAIN` environment variable support
  - Default production domain: `https://estimation-calculator.mydevfactory.com`
  - Added `/api/health` endpoint for frontend health checks
  - Maintains `/health` endpoint for backward compatibility

## How It Works

### Local Development
1. Frontend runs on `http://localhost:5173`
2. Frontend detects `window.location.hostname === 'localhost'`
3. Frontend API calls go to `http://localhost:8000/api`
4. Backend CORS allows `http://localhost:5173` origins

### Live Production
1. Frontend deployed to `https://estimation-calculator.mydevfactory.com`
2. Frontend detects `window.location.hostname !== 'localhost'`
3. Frontend API calls go to `/api` (relative path on same domain)
4. Nginx reverse proxy forwards `/api` to backend on `http://127.0.0.1:8000`
5. Backend CORS allows `https://estimation-calculator.mydevfactory.com` origin

## API Base URL Detection

The `apiConfig.js` file implements this priority:

```javascript
// Priority 1: Environment variable (from .env files)
import.meta.env.VITE_API_BASE_URL

// Priority 2: Localhost detection
isLocalhost ? 'http://localhost:8000/api' : '...'

// Priority 3: Live server (use current origin)
window.location.origin + '/api'
```

## Testing Locally

### 1. Backend Health Check
```bash
curl http://localhost:8000/api/health
```

Response:
```json
{
  "status": "healthy",
  "version": "2.0",
  "mode": "fixed-cost-estimation"
}
```

### 2. Frontend Console Check
Open browser console (F12) and verify:
```
[API Config] isLocalhost: true
[API Config] API_BASE_URL: http://localhost:8000/api
[API Config] window.location.origin: http://localhost:5173
```

### 3. API Call Test
1. Login with test credentials
2. Open Network tab (F12 → Network)
3. Verify requests go to `http://localhost:8000/api/auth/login`
4. Check response status is 200/201

### 4. File Operations Test
1. Create/load an estimate with files
2. Download a file or view comment attachment
3. Verify file URL format: `http://localhost:8000/api/files/{id}`

## Testing Live (Production)

### 1. Backend Health Check
```bash
curl https://estimation-calculator.mydevfactory.com/api/health
```

### 2. Frontend Console Check
```
[API Config] isLocalhost: false
[API Config] API_BASE_URL: https://estimation-calculator.mydevfactory.com/api
[API Config] window.location.origin: https://estimation-calculator.mydevfactory.com
```

### 3. API Call Test
1. Login on live site
2. Open Network tab
3. Verify requests go to `/api/auth/login` (proxied to backend)
4. Check response status is 200/201

### 4. Verify Reverse Proxy
```bash
curl -i https://estimation-calculator.mydevfactory.com/api/health
```

Should see 200 response with health check data.

## Nginx Reverse Proxy Configuration

Required on live server to forward API requests to backend:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

See `API_CONFIGURATION.md` for complete Nginx configuration.

## Error Handling Improvements

### Network Error Logs
When backend is unreachable:
```
[API Error] Cannot connect to server at http://localhost:8000/api
[API Error] Check that the backend API is running and accessible.
```

### API Error Response
```javascript
{
  url: "http://localhost:8000/api/auth/login",
  status: 500,
  message: "Internal Server Error",
  data: { detail: "..." }
}
```

## Backward Compatibility

✅ All existing features work without changes:
- Login/Signup/Email verification
- Estimate creation/editing/deletion
- Admin dashboard and comments
- File uploads and downloads
- PDF/CSV exports
- Notifications

No business logic or estimation logic was modified.

## Environment Variables

### Backend
- `ENVIRONMENT` - Set to "production" on live server
- `PRODUCTION_DOMAIN` - Live domain URL (default: `https://estimation-calculator.mydevfactory.com`)

### Frontend
- `VITE_API_BASE_URL` - Optional override for API base URL
  - Local: `http://localhost:8000/api`
  - Live: `/api` (relative path)

## Files to Deploy

### Local Testing (No additional files needed)
- Just run `npm run dev` (frontend) and `python -m uvicorn app.main:app --reload` (backend)

### Live Production
1. Build frontend: `npm run build`
2. Copy `frontend/dist/` to web server
3. Deploy backend with systemd service
4. Configure Nginx reverse proxy
5. Set environment variables: `ENVIRONMENT=production` and `PRODUCTION_DOMAIN`

## Documentation

### New Files
- **`API_CONFIGURATION.md`** - Complete API configuration guide
  - Local development setup
  - Live deployment setup
  - Nginx configuration examples
  - Troubleshooting guide

## Performance Impact

✅ No performance degradation:
- All API calls use the same axios instance
- Caching behavior unchanged
- Network optimization maintained

## Security Implications

✅ No security issues introduced:
- Environment detection is transparent
- No credentials exposed
- CORS properly configured
- File downloads still protected

## Migration Guide

If updating existing deployment:

1. **Backend**:
   - Update `backend/app/main.py`
   - Set `ENVIRONMENT=production` environment variable
   - Restart backend service

2. **Frontend**:
   - Update all frontend files
   - Run `npm run build`
   - Deploy updated `dist/` folder
   - Clear browser cache or use cache busting

3. **No downtime required** - backward compatible

## Summary Table

| Aspect | Before | After |
|--------|--------|-------|
| Hardcoded URLs | ✗ Yes | ✓ No |
| Environment detection | ✗ Manual | ✓ Automatic |
| Live/Local switching | ✗ Code edit | ✓ Automatic |
| Error handling | ✗ Generic | ✓ Detailed logging |
| File URLs | ✗ Hardcoded | ✓ Dynamic |
| CORS config | ⚠ Basic | ✓ Enhanced |
| Health check | ✓ At /health | ✓ Also at /api/health |

## Next Steps

1. ✅ Test locally with `http://localhost:5173`
2. ✅ Verify backend health check works
3. ✅ Test all features (login, estimates, admin, files)
4. ✅ Build production bundle: `npm run build`
5. ✅ Deploy to `https://estimation-calculator.mydevfactory.com`
6. ✅ Configure Nginx reverse proxy
7. ✅ Test live features
8. ✅ Verify API calls don't go to localhost

## Support

For issues:
1. Check browser console for API config logs
2. Check Network tab for actual API URLs
3. Review `API_CONFIGURATION.md` troubleshooting section
4. Verify environment variables are set correctly
