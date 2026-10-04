@echo off
rem Lance le backend et le frontend dans deux fenetres, puis ouvre le navigateur.
cd /d "%~dp0"
start "SentiShop - backend (8080)" cmd /k "%~dp0start-backend.cmd"
start "SentiShop - frontend (4200)" cmd /k "%~dp0start-frontend.cmd"
echo Demarrage en cours... le navigateur s'ouvrira dans 40 secondes.
timeout /t 40 /nobreak >nul
start "" http://localhost:4200
