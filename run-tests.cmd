@echo off
rem Lance tous les tests : backend (JUnit + Mockito + MockWebServer) puis frontend (Jasmine/Karma).
cd /d "%~dp0"
echo ===== Tests backend =====
pushd sentiment-analysis
call .\mvnw.cmd -B test || (popd & goto :error)
popd
echo ===== Tests frontend =====
pushd frontend
if not exist node_modules call npm install
call npx ng test --watch=false --browsers=ChromeHeadless || (popd & goto :error)
popd
echo.
echo Tous les tests sont verts.
pause
goto :eof

:error
echo Des tests ont echoue.
pause
exit /b 1
