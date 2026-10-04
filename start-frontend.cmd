@echo off
rem Demarre l'application Angular sur http://localhost:4200 (proxy /api -> localhost:8080)
cd /d "%~dp0frontend"
if not exist node_modules (
  echo Installation des dependances npm...
  call npm install || goto :error
)
call npm start
goto :eof

:error
echo Echec de npm install.
pause
