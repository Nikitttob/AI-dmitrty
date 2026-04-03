@echo off
chcp 65001 >nul
title Установка Ассистента ЖКХ + Право

echo.
echo ╔══════════════════════════════════════════════╗
echo ║   🏠 Установка Ассистента ЖКХ + Право        ║
echo ╚══════════════════════════════════════════════╝
echo.

:: Проверка Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js не найден!
    echo    Скачайте и установите с https://nodejs.org
    echo    После установки перезапустите этот скрипт.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo ✅ Node.js найден: %NODE_VER%

:: Установка зависимостей
echo.
echo 📦 Устанавливаю зависимости...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Ошибка установки зависимостей
    pause
    exit /b 1
)
echo ✅ Зависимости установлены

:: Запрос API ключа
echo.
echo ═══════════════════════════════════════════════
echo  Для полноценной работы нужен API ключ Anthropic
echo  Получить: https://console.anthropic.com
echo  (Можно пропустить — будет работать оффлайн)
echo ═══════════════════════════════════════════════
echo.
set /p API_KEY="Вставьте API ключ (или нажмите Enter для пропуска): "

if not "%API_KEY%"=="" (
    echo ANTHROPIC_API_KEY=%API_KEY%> .env
    echo PORT=3000>> .env
    echo MODEL=claude-sonnet-4-20250514>> .env
    echo ✅ API ключ сохранён в .env
) else (
    echo PORT=3000> .env
    echo MODEL=claude-sonnet-4-20250514>> .env
    echo ⚠️  Работаю без API ключа (оффлайн-режим)
)

:: Запуск
echo.
echo 🚀 Запускаю сервер...
echo    Откройте в браузере: http://localhost:3000
echo    Для остановки нажмите Ctrl+C
echo.

:: Загрузка .env переменных
for /f "tokens=1,2 delims==" %%a in (.env) do set %%a=%%b

node server.js
pause
