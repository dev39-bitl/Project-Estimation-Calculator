# Deployment Guide - Project Estimation Calculator

This guide covers deploying the Project Estimation Calculator on a Linux server with Nginx and systemd.

**⚡ TL;DR:** After one-time server setup, deployments are automated. Pushing code alone is NOT enough—you must run the deploy script or manually restart services.

---

## 📋 Table of Contents

1. [Quick Reference](#quick-reference)
2. [One-Time Server Setup](#one-time-server-setup)
3. [Future Deployments](#future-deployments)
4. [Environment Configuration](#environment-configuration)
5. [Health Checks](#health-checks)
6. [Troubleshooting](#troubleshooting)
7. [Manual Steps (if deploy.sh not used)](#manual-steps)

---

## 🚀 Quick Reference

### First Time Setup (One-time)
```bash
# 1. Server preparation
# See: One-Time Server Setup section below

# 2. Clone project
cd /var/www
git clone <REPO_URL> estimation-calculator
cd estimation-calculator

# 3. Configure backend
cd backend
cp .env.example .env
# Edit .env with real values
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate

# 4. Configure Nginx
sudo cp deployment/nginx.conf.example /etc/nginx/sites-available/estimation-calculator
# Edit domain name in nginx config
sudo ln -s /etc/nginx/sites-available/estimation-calculator /etc/nginx/sites-enabled/

# 5. Configure backend service
sudo cp deployment/estimation-backend.service.example /etc/systemd/system/estimation-backend.service
# Edit paths in service file if different
sudo systemctl daemon-reload
sudo systemctl enable estimation-backend

# 6. Setup SSL
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d estimation-calculator.mydevfactory.com

# 7. Start services
sudo systemctl start estimation-backend
sudo systemctl reload nginx

# 8. Verify
curl https://estimation-calculator.mydevfactory.com/api/health
```

### Future Deployments (After Setup)
```bash
# Push code to git
git push origin main

# On server: pull and deploy
cd /var/www/estimation-calculator
sudo deployment/deploy.sh
```

**OR manually:**
```bash
cd /var/www/estimation-calculator
git pull
cd backend && venv/bin/pip install -r requirements.txt
cd ../frontend && npm install && npm run build
sudo systemctl restart estimation-backend
sudo systemctl reload nginx
```

---

## 🏗️ One-Time Server Setup

### Prerequisites

- Ubuntu 20.04+ or similar Linux
- SSH access with sudo privileges
- Domain name pointing to server IP
- ~1GB free disk space

### Step 1: System Update

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget python3 python3-venv python3-pip nodejs npm nginx certbot python3-certbot-nginx
```

### Step 2: Create Application User & Directory

```bash
# Create app user
sudo useradd -m -s /bin/bash app-estimator

# Create application directory
sudo mkdir -p /var/www/estimation-calculator
sudo chown app-estimator:app-estimator /var/www/estimation-calculator
sudo chown www-data:www-data /var/www/estimation-calculator  # For Nginx access

# Create upload directory
sudo mkdir -p /var/www/estimation-calculator/backend/uploads
sudo chown www-data:www-data /var/www/estimation-calculator/backend/uploads
```

### Step 3: Clone Project

```bash
cd /var/www
git clone <YOUR_REPO_URL> estimation-calculator
cd estimation-calculator
```

### Step 4: Backend Setup

```bash
cd /var/www/estimation-calculator/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install --upgrade pip
pip install -r requirements.txt

# Create .env from template
cp .env.example .env

# Edit .env with your configuration
# ⚠️ IMPORTANT: Set real values for:
# - SECRET_KEY (generate with: python -c "import secrets; print(secrets.token_urlsafe(32))")
# - SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD
# - FRONTEND_URL, PRODUCTION_DOMAIN
nano .env

deactivate
```

### Step 5: Frontend Setup

```bash
cd /var/www/estimation-calculator/frontend

# Install dependencies
npm install

# Build production bundle
npm run build
```

### Step 6: Nginx Configuration

```bash
# Copy Nginx config
sudo cp /var/www/estimation-calculator/deployment/nginx.conf.example \
       /etc/nginx/sites-available/estimation-calculator

# Edit to match your domain
sudo nano /etc/nginx/sites-available/estimation-calculator
# Update: server_name, root path, ssl_certificate paths

# Create symlink to enable
sudo ln -s /etc/nginx/sites-available/estimation-calculator /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# If test passes, reload
sudo systemctl reload nginx
```

### Step 7: SSL Certificate (Let's Encrypt)

```bash
# Get SSL certificate
sudo certbot certonly --nginx -d estimation-calculator.mydevfactory.com
# Follow prompts to verify domain ownership

# The certificate will auto-renew with cron job
```

### Step 8: Backend Service Setup

```bash
# Copy systemd service file
sudo cp /var/www/estimation-calculator/deployment/estimation-backend.service.example \
       /etc/systemd/system/estimation-backend.service

# Edit if paths are different
sudo nano /etc/systemd/system/estimation-backend.service

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable service (auto-start on reboot)
sudo systemctl enable estimation-backend

# Start service
sudo systemctl start estimation-backend

# Verify it's running
sudo systemctl status estimation-backend
```

### Step 9: Verify Installation

```bash
# Check backend is running
curl http://127.0.0.1:8000/api/health
# Expected: {"status": "healthy", ...}

# Check frontend is accessible
curl https://estimation-calculator.mydevfactory.com/
# Should return HTML

# Check API through Nginx
curl https://estimation-calculator.mydevfactory.com/api/health
# Expected: {"status": "healthy", ...}
```

---

## 📦 Future Deployments

### Important: Code Changes Don't Auto-Deploy

**Pushing code to git does NOT automatically restart the backend or rebuild the frontend.**

You must explicitly deploy using one of these methods:

### Method 1: Automated Deploy Script (Recommended)

```bash
cd /var/www/estimation-calculator
sudo ./deployment/deploy.sh
```

This script:
1. Pulls latest code
2. Installs Python dependencies
3. Builds frontend
4. Restarts backend service
5. Reloads Nginx

### Method 2: Manual Steps

```bash
# SSH into server
ssh user@estimation-calculator.mydevfactory.com
cd /var/www/estimation-calculator

# Pull latest code
git pull origin main

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Build frontend
cd ../frontend
npm install
npm run build

# Restart backend
sudo systemctl restart estimation-backend

# Reload Nginx
sudo systemctl reload nginx

# Verify
curl https://estimation-calculator.mydevfactory.com/api/health
```

### Method 3: CI/CD Pipeline (Advanced)

Set up GitHub Actions, GitLab CI, or similar to automatically run the deploy script on code push. See `.github/workflows/` for examples.

---

## ⚙️ Environment Configuration

### Backend .env

Copy from `backend/.env.example` and configure:

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

**Critical Settings:**
- `SECRET_KEY` - Generate: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` - Email provider
- `FRONTEND_URL` - Point to your live frontend
- `PRODUCTION_DOMAIN` - Your live domain for CORS
- `APP_ENV` - Set to `production`

### Frontend Environment Files

**Already configured and committed:**
- `frontend/.env.development` - Used when running `npm run dev`
- `frontend/.env.production` - Used when running `npm run build`

No changes needed unless you want to override the automatic environment detection.

---

## 🏥 Health Checks

### Local Backend Health

```bash
# SSH to server
curl http://127.0.0.1:8000/api/health
```

### Live Frontend → API

```bash
# From your computer
curl https://estimation-calculator.mydevfactory.com/api/health
```

### Automated Health Check Script

```bash
# On server
./deployment/check-live.sh https://estimation-calculator.mydevfactory.com
```

### Expected Response

```json
{
  "status": "healthy",
  "version": "2.0",
  "mode": "fixed-cost-estimation"
}
```

---

## 🔍 Troubleshooting

### Backend Service Won't Start

```bash
# Check status
sudo systemctl status estimation-backend

# View logs (last 20 lines)
sudo journalctl -u estimation-backend -n 20 -e

# View logs in real-time
sudo journalctl -u estimation-backend -f
```

Common issues:
- Port 8000 already in use: `sudo lsof -i :8000`
- Permission denied: Check file ownership `ls -la /var/www/estimation-calculator`
- .env file missing: Copy from `.env.example`

### Nginx Not Forwarding to Backend

```bash
# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Test backend directly
curl http://127.0.0.1:8000/api/health
```

### SSL Certificate Issues

```bash
# Renew certificate
sudo certbot renew

# Check certificate expiration
sudo certbot certificates

# Manual renewal if needed
sudo certbot renew --force-renewal
```

### Frontend Shows API Errors

1. Check browser console (F12)
2. Look for actual API URL being called
3. Verify it's `/api` not `http://localhost:8000/api`
4. Check backend is running: `curl https://estimation-calculator.mydevfactory.com/api/health`

---

## 🛠️ Manual Steps (Detailed)

If you prefer not to use the deploy script, here are detailed manual steps:

### 1. Pull Latest Code

```bash
cd /var/www/estimation-calculator
git pull origin main
```

### 2. Update Backend Dependencies

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
deactivate
```

### 3. Build Frontend

```bash
cd ../frontend
npm install
npm run build
```

### 4. Restart Backend Service

```bash
sudo systemctl restart estimation-backend

# Wait a moment then verify
sleep 2
sudo systemctl status estimation-backend
```

### 5. Reload Nginx

```bash
sudo systemctl reload nginx
```

### 6. Run Health Checks

```bash
# Backend
curl http://127.0.0.1:8000/api/health

# Frontend → API
curl https://estimation-calculator.mydevfactory.com/api/health
```

---

## 📝 Common Commands

### Manage Backend Service

```bash
# Start
sudo systemctl start estimation-backend

# Stop
sudo systemctl stop estimation-backend

# Restart
sudo systemctl restart estimation-backend

# Status
sudo systemctl status estimation-backend

# Enable auto-start
sudo systemctl enable estimation-backend

# Disable auto-start
sudo systemctl disable estimation-backend
```

### View Logs

```bash
# Backend logs (real-time)
sudo journalctl -u estimation-backend -f

# Backend logs (last 50 lines)
sudo journalctl -u estimation-backend -n 50

# Nginx access log
sudo tail -f /var/log/nginx/estimation-calculator-access.log

# Nginx error log
sudo tail -f /var/log/nginx/estimation-calculator-error.log
```

### Rebuild Frontend Only

```bash
cd /var/www/estimation-calculator/frontend
npm run build
sudo systemctl reload nginx
```

### Test API Connection

```bash
# From anywhere, test backend through frontend
curl -v https://estimation-calculator.mydevfactory.com/api/health

# Check API docs
curl https://estimation-calculator.mydevfactory.com/api/docs
```

---

## 🔐 Security Best Practices

1. **Never commit `.env` file** - Only commit `.env.example`
2. **Use strong SECRET_KEY** - Generate with cryptographically secure method
3. **Enable HTTPS** - Always use SSL/TLS (Let's Encrypt is free)
4. **Keep dependencies updated** - Run `pip install --upgrade -r requirements.txt` regularly
5. **Use firewall** - Only allow ports 80, 443, and 22
6. **Monitor logs** - Set up alerts for errors and suspicious activity

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────┐
│                                             │
│  Internet User                              │
│     ↓                                       │
│  ┌──────────────────────────────────────┐  │
│  │  HTTPS (Port 443)                    │  │
│  │  estimation-calculator.mydevfactory.com
│  └──────────────────────────────────────┘  │
│     ↓                                       │
│  ┌──────────────────────────────────────┐  │
│  │  Nginx (Reverse Proxy)               │  │
│  │  - Serves /index.html                │  │
│  │  - Forwards /api/* to backend        │  │
│  └──────────────────────────────────────┘  │
│     ↓                                       │
│  ┌──────────────────────────────────────┐  │
│  │  FastAPI Backend                     │  │
│  │  http://127.0.0.1:8000/api           │  │
│  │  (Not exposed to internet)           │  │
│  └──────────────────────────────────────┘  │
│     ↓                                       │
│  ┌──────────────────────────────────────┐  │
│  │  SQLite Database                     │  │
│  │  /backend/app.db                     │  │
│  └──────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 📞 Support & Documentation

- **API Docs**: `https://estimation-calculator.mydevfactory.com/api/docs`
- **Source Code**: See repository
- **Configuration**: Check `deployment/` folder for example files
- **Local Development**: See project README.md

---

## 🎯 Summary

| Task | First Time? | Command | Time |
|------|-------------|---------|------|
| Setup server | Yes | See "One-Time Server Setup" | ~30 min |
| Configure backend | Yes | Edit `.env` | ~5 min |
| Setup SSL | Yes | `certbot certonly` | ~5 min |
| Deploy code | No | `sudo ./deploy.sh` | ~2 min |
| Restart backend | No | `sudo systemctl restart estimation-backend` | ~5 sec |
| Rebuild frontend | No | `npm run build` + reload nginx | ~1 min |
| Check health | Any | `curl /api/health` | ~1 sec |

**Remember:** After setup, always run `sudo ./deploy.sh` or manually restart services after code changes!
