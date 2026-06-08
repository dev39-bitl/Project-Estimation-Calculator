@echo off
echo Starting Brainium Project Estimation Calculator Backend...
echo Backend will be available at http://localhost:8000
echo API docs at http://localhost:8000/docs
echo.
cd /d "%~dp0backend"
python -m uvicorn app.main:app --reload --port 8000
