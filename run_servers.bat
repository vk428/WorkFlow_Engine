@echo off
echo ====================================================
echo   HalleyX - Dynamic Workflow Automation Platform
echo ====================================================

echo [1/3] Starting Django API Server and Channels (via Daphne)...
start "HalleyX Backend API" cmd /c "cd backend && call venv\Scripts\activate && python manage.py runserver"

echo [2/3] Starting Celery Worker (requires Redis running on port 6379)...
start "HalleyX Celery Worker" cmd /c "cd backend && call venv\Scripts\activate && celery -A config worker -l INFO -P eventlet"

echo [3/3] Starting React Vite Frontend...
start "HalleyX React Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo All services are starting up!
echo - Frontend: http://localhost:5173
echo - Backend API: http://localhost:8000/api/v1/
echo - Ensure Redis daemon is active for WebSockets and Celery to function properly.
echo ====================================================
pause
