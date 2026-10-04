@echo off
rem Demarre l'API Spring Boot sur http://localhost:8080 (Swagger : /swagger-ui.html)
rem Necessite Java 21 (variable JAVA_HOME).
cd /d "%~dp0sentiment-analysis"
if not exist .env (
  echo [ATTENTION] Fichier sentiment-analysis\.env absent.
  echo Copiez .env.example en .env et renseignez HF_TOKEN=hf_...
  echo.
)
call .\mvnw.cmd spring-boot:run
pause
