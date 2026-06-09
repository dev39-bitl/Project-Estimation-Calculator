# Gmail SMTP Setup Guide

## Overview

This application uses Gmail SMTP for:
- Email verification on signup (required)
- Event-based notification emails (optional, controlled by `NOTIFICATION_EMAIL_ENABLED`)

SMTP credentials are loaded **exclusively from environment variables**.  
The Gmail App Password is **never hardcoded** in any source file.

---

## Setup Steps

### 1. Copy the example env file

```bash
cp backend/.env.example backend/.env
```

### 2. Enable Gmail 2-Step Verification

Go to: https://myaccount.google.com/security  
Enable **2-Step Verification** for `web.brainium@gmail.com`.

### 3. Generate a Gmail App Password

1. Visit: https://myaccount.google.com/apppasswords
2. Select app: **Mail**
3. Select device: **Other** → enter "Brainium Server"
4. Click **Generate**
5. Copy the 16-character password (spaces are OK — Gmail ignores them)

### 4. Add the App Password to backend/.env ONLY

Open `backend/.env` and replace the placeholder:

```
SMTP_PASSWORD=PASTE_GMAIL_APP_PASSWORD_HERE
```

with your real app password:

```
SMTP_PASSWORD=abcd efgh ijkl mnop
```

> ⚠️ **NEVER commit `backend/.env` to version control.**  
> It is listed in `.gitignore` for this reason.

---

## Required .env Variables

```env
SMTP_PROVIDER=gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=web.brainium@gmail.com
SMTP_PASSWORD=<your-gmail-app-password-here>
SMTP_FROM_EMAIL=web.brainium@gmail.com
SMTP_FROM_NAME=Brainium Project Estimation Portal
SMTP_USE_TLS=true
SMTP_USE_SSL=false
EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES=10
NOTIFICATION_EMAIL_ENABLED=true
```

---

## Restart After Changes

After editing `backend/.env`, restart the backend:

```bash
# Development
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Or with the batch file (Windows)
..\start_backend.bat
```

---

## Testing

### Test signup email verification
1. Start backend with SMTP configured.
2. Open the frontend and click **Create account**.
3. Fill in name, email, password.
4. On success, the **Verify Email** screen appears.
5. Check the inbox for `web.brainium@gmail.com` → look for the 6-digit code.
6. Enter the code on the verify screen.
7. You should see "Email verified successfully" and be redirected to Login.

### Test notification emails
1. Set `NOTIFICATION_EMAIL_ENABLED=true` in `backend/.env`.
2. Restart backend.
3. Create or update an estimate as an estimator — admins receive an email.
4. As admin, add a comment, lock/unlock an estimate, or change status — estimator receives an email.

---

## Security Notes

- `SMTP_PASSWORD` is **never logged**, even on authentication failure.
- Logs show only `SMTP_USERNAME` and the error type — never the password.
- The `.env` file is excluded from git via `.gitignore`.
- Use `backend/.env.example` as a reference template (contains only placeholders).
