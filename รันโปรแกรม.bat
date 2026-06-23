@echo off
title ระบบตารางนำขบวน (Motorcade Schedule)
chcp 65001 > nul

echo ===================================================
echo     กำลังเริ่มระบบตารางนำขบวน (Motorcade Schedule)
echo ===================================================
echo.

:: 1. Check if Python is installed
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] ไม่พบการติดตั้ง Python ในเครื่องนี้!
    echo กรุณาติดตั้ง Python 3 ก่อนรันโปรแกรม
    echo (คุณสามารถดาวน์โหลดได้ที่: https://www.python.org/downloads/)
    echo.
    pause
    exit /b
)

:: 2. Check and install Flask and Flask-CORS
echo [1/3] กำลังตรวจสอบความพร้อมของไลบรารี...
python -c "import flask, flask_cors" >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] ไม่พบไลบรารี Flask หรือ Flask-CORS
    echo กำลังดำเนินการติดตั้ง (ต้องมีการเชื่อมต่ออินเทอร์เน็ตในครั้งแรก)...
    pip install flask flask-cors
    if %errorlevel% neq 0 (
        echo [ERROR] ไม่สามารถติดตั้งไลบรารีได้สำเร็จ! กรุณาตรวจสอบอินเทอร์เน็ตหรือสิทธิ์ของยูสเซอร์
        pause
        exit /b
    )
)
echo [OK] ตรวจสอบและเตรียมไลบรารีเรียบร้อยแล้ว

:: 3. Start Python Server in background
echo [2/3] กำลังเปิดเซิร์ฟเวอร์ระบบตารางนำขบวน (Port 5000)...
start "" /b python app.py

:: Wait 2 seconds for server to start
timeout /t 2 /nobreak >nul

:: 4. Open index.html in default browser
echo [3/3] กำลังเปิดหน้าโปรแกรมหลักในเว็บเบราว์เซอร์...
start "" "index.html"

echo.
echo ===================================================
echo    เปิดระบบเสร็จสมบูรณ์!
echo    * กรุณาเปิดหน้าต่างนี้ทิ้งไว้ขณะใช้งานโปรแกรม
echo    * เมื่อใช้งานเสร็จแล้ว สามารถปิดหน้าต่างนี้ได้เลย
echo ===================================================
echo.
pause
