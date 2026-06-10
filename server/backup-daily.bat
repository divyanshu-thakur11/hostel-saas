@echo off
title Hostel Manager - Daily Backup
echo.
echo Running daily backup...
node "%~dp0backup-daily.js"
if %errorlevel% neq 0 (
  echo Backup failed! Check your server connection.
  pause
)
