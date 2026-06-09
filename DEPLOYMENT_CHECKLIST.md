# Deployment Checklist

Use this checklist to verify your deployment is complete and working correctly.

## ✅ Local Development Setup

- [ ] Backend running: `http://localhost:8000`
- [ ] Frontend running: `http://localhost:5173`
- [ ] Browser console shows API config:
  ```
  [API Config] isLocalhost: true
  [API Config] API_BASE_URL: http://localhost:8000/api
  ```
- [ ] Login works
- [ ] Estimates can be created/edited/deleted
- [ ] Files can be uploaded and downloaded
- [ ] Admin panel accessible (use web.brainium@gmail.com)
- [ ] Health check works: `curl http://localhost:8000/api/health`

## ✅ One-Time Server Setup

### Prerequisites
- [ ] Ubuntu 20.04+ server with sudo access
- [ ] Domain name points to server IP
- [ ] Git access (can clone repository)
- [ ] ~1GB free disk space

### System Preparation
- [ ] System updated: `sudo apt update && apt upgrade -y`
- [ ] Required packages installed:
  ```bash
  git curl wget python3 python3-venv python3-pip nodejs npm nginx certbot python3-certbot-nginx
  ```
- [ ] Application directory created: `/var/www/estimation-calculator`
- [ ] Upload directory created: `/var/www/estimation-calculator/backend/uploads`
- [ ] Directory permissions set correctly for www-data

### Code & Dependencies
- [ ] Repository cloned to `/var/www/estimation-calculator`
- [ ] Backend virtual environment created
- [ ] Backend requirements installed: `pip install -r requirements.txt`
- [ ] Backend `.env` copied from `.env.example`
- [ ] Backend `.env` configured with real values:
  - [ ] `SECRET_KEY` generated (strong, unique)
  - [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` set
  - [ ] `FRONTEND_URL` points to live domain
  - [ ] `PRODUCTION_DOMAIN` set correctly
- [ ] Frontend dependencies installed: `npm install`
- [ ] Frontend built: `npm run build`

### Nginx Configuration
- [ ] Nginx config copied from `deployment/nginx.conf.example`
- [ ] Domain name updated in Nginx config
- [ ] Nginx config enabled: `ln -s /etc/nginx/sites-available/... /etc/nginx/sites-enabled/`
- [ ] Nginx config test passed: `sudo nginx -t`
- [ ] Nginx reloaded: `sudo systemctl reload nginx`

### SSL Certificate
- [ ] SSL certificate obtained: `certbot certonly --nginx -d your-domain.com`
- [ ] Certificate paths in Nginx config are correct
- [ ] Certificate auto-renewal configured (certbot sets this up)

### Backend Service
- [ ] Systemd service copied from `deployment/estimation-backend.service.example`
- [ ] Service file paths updated if different
- [ ] Service enabled: `sudo systemctl enable estimation-backend`
- [ ] Service started: `sudo systemctl start estimation-backend`
- [ ] Service status is running: `sudo systemctl status estimation-backend`

### Initial Verification
- [ ] Backend health check works locally:
  ```bash
  curl http://127.0.0.1:8000/api/health
  ```
- [ ] Frontend is accessible:
  ```bash
  curl https://your-domain.com/
  ```
- [ ] API is accessible through Nginx:
  ```bash
  curl https://your-domain.com/api/health
  ```
- [ ] No CORS errors in browser console
- [ ] No Nginx errors: `sudo tail -f /var/log/nginx/error.log`

## ✅ Live Deployment - First Update

After initial setup is complete:

- [ ] Code changes pushed to git main branch
- [ ] SSH to server
- [ ] Run deploy script: `sudo /var/www/estimation-calculator/deployment/deploy.sh`
- [ ] Deploy script completed without errors
- [ ] Backend service is running: `sudo systemctl status estimation-backend`
- [ ] Health check passes: `curl https://your-domain.com/api/health`
- [ ] Frontend is updated
- [ ] Login works on live site
- [ ] Can create/view/edit/delete estimates
- [ ] Files upload and download work
- [ ] Admin panel works

## ✅ Live Deployment - Ongoing Updates

For each code update:

- [ ] Changes committed and pushed to main branch
- [ ] SSH to server
- [ ] Navigate to project: `cd /var/www/estimation-calculator`
- [ ] Run deploy script: `sudo ./deployment/deploy.sh`
- [ ] Verify no errors in output
- [ ] Health check passes: `curl https://your-domain.com/api/health`
- [ ] Verify in browser:
  - [ ] Frontend loads
  - [ ] Can log in
  - [ ] Can view estimates
  - [ ] No console errors
  - [ ] Network tab shows API calls to `/api/*` (not `localhost`)

## 🔧 Troubleshooting Checklist

### Frontend Issues

**Symptoms:** Frontend won't load, shows blank page, or 404
- [ ] Check Nginx is running: `sudo systemctl status nginx`
- [ ] Check frontend built: `ls /var/www/estimation-calculator/frontend/dist/index.html`
- [ ] Check Nginx error log: `sudo tail -f /var/log/nginx/error.log`
- [ ] Verify domain in Nginx config

**Symptoms:** API calls fail, "Cannot connect to server"
- [ ] Check browser console API config:
  ```
  [API Config] API_BASE_URL should be https://your-domain.com/api
  ```
- [ ] Check backend is running: `sudo systemctl status estimation-backend`
- [ ] Test backend directly: `curl http://127.0.0.1:8000/api/health`
- [ ] Test through Nginx: `curl https://your-domain.com/api/health`

### Backend Issues

**Symptoms:** Service won't start
- [ ] Check error: `sudo journalctl -u estimation-backend -n 50`
- [ ] Verify port 8000 not in use: `sudo lsof -i :8000`
- [ ] Check `.env` file exists: `ls /var/www/estimation-calculator/backend/.env`
- [ ] Verify virtual environment: `ls /var/www/estimation-calculator/backend/venv`

**Symptoms:** Backend crashes after deploy
- [ ] Check logs: `sudo journalctl -u estimation-backend -f`
- [ ] Verify requirements installed: `venv/bin/pip list | grep fastapi`
- [ ] Check database permissions: `ls -la /var/www/estimation-calculator/backend/`

### Nginx Issues

**Symptoms:** HTTPS certificate errors
- [ ] Check certificate: `sudo certbot certificates`
- [ ] Check expiration: `sudo certbot renew --dry-run`
- [ ] Verify paths in Nginx config

**Symptoms:** 502 Bad Gateway or proxy errors
- [ ] Verify backend is running on 127.0.0.1:8000
- [ ] Check Nginx proxy_pass config
- [ ] Check firewall allows Nginx→Backend: `sudo ufw status`
- [ ] Test backend port: `netstat -an | grep 8000`

## 📝 Important Notes

### Code Deployment is NOT Automatic
✗ **Git push alone does NOT deploy the code**
✓ **You MUST run deploy script or restart services manually**

### Environment Files
✓ `.env.example` files ARE committed and shared
✗ `.env` files with real secrets are NOT committed (in .gitignore)

### Security
- [ ] `.env` file is not world-readable: `ls -la /var/www/estimation-calculator/backend/.env`
- [ ] Upload directory is owned by www-data
- [ ] HTTPS enabled and working
- [ ] Firewall configured properly

### Backups
- [ ] Database backed up regularly
- [ ] `.env` file backed up securely (NOT in git)
- [ ] Nginx and systemd configs backed up

## 🚀 Quick Commands

### On Server

```bash
# Deploy new code
sudo /var/www/estimation-calculator/deployment/deploy.sh

# Restart backend
sudo systemctl restart estimation-backend

# View backend logs
sudo journalctl -u estimation-backend -f

# View Nginx logs
sudo tail -f /var/log/nginx/estimation-calculator-*.log

# Health check
curl https://your-domain.com/api/health

# Run manual checks
/var/www/estimation-calculator/deployment/check-live.sh
```

### Local Development

```bash
# Start backend
cd backend
python -m uvicorn app.main:app --reload

# Start frontend (in another terminal)
cd frontend
npm run dev

# Test API
curl http://localhost:8000/api/health
```

## 📞 Support

- See `DEPLOYMENT.md` for detailed setup instructions
- See `API_CONFIGURATION.md` for API connection details
- See `IMPLEMENTATION_SUMMARY.md` for code changes made
- Check deployment example files in `deployment/` folder

---

**Ready to deploy? Start with one-time setup, then use deploy script for all future updates!**
