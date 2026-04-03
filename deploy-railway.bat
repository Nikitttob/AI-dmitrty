@echo off
chcp 65001 >nul
title Деплой на Railway

echo.
echo ╔══════════════════════════════════════════════╗
echo ║   🚀 Деплой на Railway                       ║
echo ╚══════════════════════════════════════════════╝
echo.

:: Проверка git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Git не найден!
    echo    Скачайте: https://git-scm.com/downloads
    pause
    exit /b 1
)
echo ✅ Git найден

:: Проверка npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm не найден! Установите Node.js: https://nodejs.org
    pause
    exit /b 1
)
echo ✅ npm найден

:: Установка Railway CLI
echo.
echo 📦 Устанавливаю Railway CLI...
call npm install -g @railway/cli
if %errorlevel% neq 0 (
    echo ❌ Ошибка установки Railway CLI
    pause
    exit /b 1
)
echo ✅ Railway CLI установлен

:: Авторизация
echo.
echo 🔑 Авторизация в Railway...
echo    Откроется браузер — войдите через GitHub
call npx @railway/cli login
if %errorlevel% neq 0 (
    echo ❌ Ошибка авторизации
    pause
    exit /b 1
)
echo ✅ Авторизация успешна

:: Инициализация git (если нет)
if not exist ".git" (
    echo.
    echo 📁 Инициализирую Git репозиторий...
    git init
    git add .
    git commit -m "Initial commit: ZHKH Legal Assistant"
    echo ✅ Git репозиторий создан
)

:: Создание проекта на Railway
echo.
echo 🏗️  Создаю проект на Railway...
call npx @railway/cli init
if %errorlevel% neq 0 (
    echo ❌ Ошибка создания проекта
    pause
    exit /b 1
)
echo ✅ Проект создан

:: Запрос API ключа для Railway
echo.
echo ═══════════════════════════════════════════════
echo  Установка переменных окружения на Railway
echo ═══════════════════════════════════════════════
echo.
set /p API_KEY="Вставьте Anthropic API ключ (или Enter для пропуска): "

if not "%API_KEY%"=="" (
    call npx @railway/cli variables set ANTHROPIC_API_KEY=%API_KEY%
    echo ✅ API ключ установлен на Railway
) else (
    echo ⚠️  Без API ключа — оффлайн-режим
)

:: Деплой
echo.
echo 🚀 Деплою на Railway...
call npx @railway/cli up
if %errorlevel% neq 0 (
    echo ❌ Ошибка деплоя
    pause
    exit /b 1
)

:: Генерация домена
echo.
echo 🌐 Генерирую публичный домен...
call npx @railway/cli domain
echo.

echo ╔══════════════════════════════════════════════╗
echo ║   ✅ Деплой завершён!                        ║
echo ║   Ссылка на приложение выше ☝️               ║
echo ║   Отправьте её руководителю                  ║
echo ╚══════════════════════════════════════════════╝
echo.
pause
