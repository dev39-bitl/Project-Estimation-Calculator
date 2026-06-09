# Ubuntu VPS Deployment Guide (No Docker)

This guide deploys:
- Frontend (Vite build) via Nginx static hosting
- Backend (FastAPI + Uvicorn) via systemd service
- SQLite database on server filesystem
- Reverse proxy `/api` to backend

Project:
- Frontend: React + Vite
- Backend: FastAPI
- DB: SQLite

## 1. Prerequisites

- Ubuntu 22.04+ VPS
- A domain name pointed to your VPS public IP (recommended)
- SSH access with a sudo user

Example values used below:
- Domain: `estimator.yourdomain.com`
- App path: `/var/www/project-estimation-calculator`
- Backend path: `/var/www/project-estimation-calculator/backend`
- Frontend path: `/var/www/project-estimation-calculator/frontend`

## 2. Server Setup

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx python3 python3-venv python3-pip nodejs npm
```

Optional: install latest Node using NodeSource if Ubuntu repo version is old.

## 3. Clone Project

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone <YOUR_REPO_URL> project-estimation-calculator
cd project-estimation-calculator
```

## 4. Backend Setup (FastAPI + Uvicorn)

```bash
cd /var/www/project-estimation-calculator/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 4.1 Create backend environment file

Create `/var/www/project-estimation-calculator/backend/.env`:

```env
ENVIRONMENT=production
SECRET_KEY=replace-with-a-long-random-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
PW_SALT=brainium-local-dev-salt-2024
DATABASE_URL=sqlite:///./test.db
API_HOST=0.0.0.0
API_PORT=8000
API_RELOAD=false
SMTP_PROVIDER=gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=web.brainium@gmail.com
SMTP_PASSWORD=replace-with-gmail-app-password
SMTP_FROM_EMAIL=web.brainium@gmail.com
SMTP_FROM_NAME=Brainium Project Estimation Portal
SMTP_USE_TLS=true
SMTP_USE_SSL=false
NOTIFICATION_EMAIL_ENABLED=true
ADMIN_NOTIFICATION_EMAIL=web.brainium@gmail.com
FRONTEND_URL=https://estimation-calculator.mydevfactory.com
APP_LOGO_URL=https://estimation-calculator.mydevfactory.com/brainium-logo.png
```

Important:
- Keep `DATABASE_URL=sqlite:///./test.db` if you want DB in backend folder.
- `API_RELOAD=false` for production.
- Set a strong `SECRET_KEY`.
- Configure SMTP variables so verification and notification emails work in production.

### 4.2 Validate backend manually

```bash
cd /var/www/project-estimation-calculator/backend
source .venv/bin/activate
python -c "from app.main import app; print('backend-ok')"
```

## 5. Frontend Build (Vite)

```bash
cd /var/www/project-estimation-calculator/frontend
npm install
npm run build
```

Build output should be in:
- `/var/www/project-estimation-calculator/frontend/dist`

## 6. Create systemd Service for Backend

Create `/etc/systemd/system/estimator-backend.service`:

```ini
[Unit]
Description=Project Estimation Calculator FastAPI Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/project-estimation-calculator/backend
Environment="PATH=/var/www/project-estimation-calculator/backend/.venv/bin"
ExecStart=/var/www/project-estimation-calculator/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Fix permissions:

```bash
sudo chown -R www-data:www-data /var/www/project-estimation-calculator
```

Enable service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable estimator-backend
sudo systemctl start estimator-backend
sudo systemctl status estimator-backend
```

## 7. Nginx Setup (Frontend + API Proxy)

Create `/etc/nginx/sites-available/estimator`:

```nginx
server {
    listen 80;
    server_name estimator.yourdomain.com;

    root /var/www/project-estimation-calculator/frontend/dist;
    index index.html;

    # Serve React app
    location / {
        try_files $uri /index.html;
    }

    # Proxy API to FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/estimator /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 8. SSL with Let’s Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d estimator.yourdomain.com
```

Check auto-renew:

```bash
sudo systemctl status certbot.timer
```

## 9. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 10. CORS Note for Production

Your backend currently has a production CORS branch in `backend/app/main.py` that uses:
- `https://yourdomain.com`

Update this to your real domain (or improve to env-driven CORS list) before production.

## 11. Verify Deployment

- Open: `https://estimator.yourdomain.com`
- API health: `https://estimator.yourdomain.com/api/health`
- Backend logs:

```bash
sudo journalctl -u estimator-backend -f
```

- Nginx logs:

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## 12. Update / Redeploy Workflow

```bash
cd /var/www/project-estimation-calculator
git pull

# backend deps (if changed)
cd backend
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart estimator-backend

# frontend rebuild
cd ../frontend
npm install
npm run build

# reload nginx
sudo systemctl reload nginx
```

## 13. Optional Hardening

- Disable password SSH login, use SSH keys only
- Change default SSH port (optional)
- Fail2ban installation
- Daily backup of SQLite DB (`backend/test.db`)

Simple DB backup command:

```bash
mkdir -p /var/backups/estimator
cp /var/www/project-estimation-calculator/backend/test.db /var/backups/estimator/test-$(date +%F-%H%M).db
```

## 14. Common Issues

1. `502 Bad Gateway`:
- Backend service not running
- Check: `sudo systemctl status estimator-backend`

2. CORS errors:
- Production domain missing in backend CORS list
- Update `backend/app/main.py` production origins

3. Frontend shows old UI after deploy:
- Browser cache; hard refresh
- Ensure `npm run build` completed and Nginx points to `frontend/dist`

4. SQLite permission errors:
- Ensure app folder owned by service user (`www-data` in this guide)

---

If you want, I can also create:
- an automated deploy script (`deploy.sh`)
- a backup rotation cron setup
- a hardened Nginx config with security headers
