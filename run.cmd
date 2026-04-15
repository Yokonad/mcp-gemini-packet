@echo off
setlocal
chcp 65001 >nul
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" -Mode Ask %*
if errorlevel 1 (
	echo.
	echo El lanzador termino con error. Revisa el mensaje en pantalla.
	pause
)
endlocal
