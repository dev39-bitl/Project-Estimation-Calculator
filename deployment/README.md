# Deployment Files

This folder contains example configuration and deployment scripts for running the Project Estimation Calculator on a production server.

## 📁 Files in This Folder

### Configuration Examples (Copy & Customize)

#### `nginx.conf.example`
Nginx reverse proxy configuration for serving the frontend and proxying API requests to the backend.

**How to use:**
1. Copy to `/etc/nginx/sites-available/estimation-calculator`
2. Update domain name and paths
3. Enable: `sudo ln -s /etc/nginx/sites-available/estimation-calculator /etc/nginx/sites-enabled/`
4. Test: `sudo nginx -t`
5. Reload: `sudo systemctl reload nginx`

#### `estimation-backend.service.example`
Systemd service unit for running the FastAPI backend with Uvicorn.

**How to use:**
1. Copy to `/etc/systemd/system/estimation-backend.service`
2. Update paths if different from defaults
3. Reload: `sudo systemctl daemon-reload`
4. Enable: `sudo systemctl enable estimation-backend`
5. Start: `sudo systemctl start estimation-backend`

### Automation Scripts

#### `deploy.sh.example`
Automated deployment script that:
- Pulls latest code from git
- Installs backend Python dependencies
- Builds frontend production bundle
- Restarts backend service
- Reloads Nginx

**How to use:**
```bash
sudo /var/www/estimation-calculator/deployment/deploy.sh
```

**Or make it executable:**
```bash
chmod +x /var/www/estimation-calculator/deployment/deploy.sh
sudo ./deploy.sh
```

#### `check-live.sh.example`
Health check script to verify:
- Frontend is accessible
- API health endpoint works
- Optional: API documentation available

**How to use:**
```bash
./deployment/check-live.sh https://estimation-calculator.mydevfactory.com
```

## 🚀 Quick Start

### Step 1: One-Time Server Setup

See `DEPLOYMENT.md` for complete step-by-step setup instructions.

### Step 2: Use Example Files

```bash
# Backend environment
cp ../backend/.env.example ../backend/.env
nano ../backend/.env  # Edit with real values

# Nginx configuration
sudo cp nginx.conf.example /etc/nginx/sites-available/estimation-calculator
sudo nano /etc/nginx/sites-available/estimation-calculator  # Edit domain

# Backend service
sudo cp estimation-backend.service.example /etc/systemd/system/estimation-backend.service

# Deploy script
chmod +x deploy.sh.example
```

### Step 3: Deploy Code

After initial setup:
```bash
sudo ./deploy.sh.example
```

Or rename without `.example` first:
```bash
mv deploy.sh.example deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
```

## 📋 What Each File Does

| File | Purpose | When Used | Edit Before Use? |
|------|---------|-----------|------------------|
| `nginx.conf.example` | Nginx reverse proxy config | One-time setup | Yes |
| `estimation-backend.service.example` | Systemd service | One-time setup | Maybe |
| `deploy.sh.example` | Automated deployment | Every code push | No |
| `check-live.sh.example` | Health check script | Verification | No |

## 🔑 Key Configuration Points

### Nginx Config
- `server_name` - Update to your domain
- `root` - Frontend dist folder path
- `proxy_pass` - Backend URL (usually 127.0.0.1:8000)
- `ssl_certificate` - Path to SSL cert (from certbot)

### Systemd Service
- `WorkingDirectory` - Backend folder path
- `User` / `Group` - Usually www-data
- `EnvironmentFile` - Path to .env file
- `ExecStart` - Uvicorn command

### Deploy Script
- `PROJECT_DIR` - Base project path
- `BACKEND_DIR` - Backend folder path
- `FRONTEND_DIR` - Frontend folder path

## 🔒 Security Notes

- **Never commit real `.env` files** - Only commit `.env.example`
- **Use strong SECRET_KEY** - Generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- **Use HTTPS** - Always enable SSL (Let's Encrypt is free)
- **Protect .env files** - Ensure they're not world-readable
- **Keep dependencies updated** - Regular `pip install --upgrade` runs

## 📚 Related Documentation

- **`DEPLOYMENT.md`** - Complete deployment guide with step-by-step instructions
- **`DEPLOYMENT_CHECKLIST.md`** - Verification checklist for all deployment steps
- **`API_CONFIGURATION.md`** - API configuration and environment details
- **`IMPLEMENTATION_SUMMARY.md`** - Summary of code changes made for deployment
- **Root `.env.example`** - Backend environment template (in `backend/` folder)

## 🆘 Troubleshooting

### Service won't start
```bash
sudo journalctl -u estimation-backend -n 50 -e
```

### Nginx not forwarding to backend
```bash
sudo nginx -t
curl http://127.0.0.1:8000/api/health
```

### Deploy script fails
```bash
sudo ./deploy.sh 2>&1 | tee deploy.log
# Check the log for specific errors
```

### Health check fails
```bash
./check-live.sh https://your-domain.com
# Shows what's working and what's not
```

See `DEPLOYMENT_CHECKLIST.md` for more troubleshooting steps.

## 📞 Support

1. Read `DEPLOYMENT.md` for detailed instructions
2. Check `DEPLOYMENT_CHECKLIST.md` for verification steps
3. Review `API_CONFIGURATION.md` for API connection issues
4. Look at example files for reference configurations

---

**Quick reminder:** After code is pushed to git, always run the deploy script or manually restart services. Code changes do NOT automatically deploy!
