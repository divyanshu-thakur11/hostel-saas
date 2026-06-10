@echo off
title Hostel Manager - Password Reset
echo.
echo  Starting Password Reset Tool...
echo  Please wait...
echo.
node "%~dp0reset-password.js"
if %errorlevel% neq 0 (
  echo.
  echo  Something went wrong. Make sure:
  echo  1. The server is running (start.bat)
  echo  2. Node.js is installed
  echo.
  pause
)
