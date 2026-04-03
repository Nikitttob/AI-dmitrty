#!/bin/bash

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   🚀 Деплой на Railway                       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Проверки
command -v git &>/dev/null || { echo "❌ Git не найден: https://git-scm.com"; exit 1; }
echo "✅ Git найден"
command -v npm &>/dev/null || { echo "❌ npm не найден: https://nodejs.org"; exit 1; }
echo "✅ npm найден"

# Railway CLI
echo ""
echo "📦 Устанавливаю Railway CLI..."
npm install -g @railway/cli || { echo "❌ Ошибка"; exit 1; }
echo "✅ Railway CLI установлен"

# Авторизация
echo ""
echo "🔑 Авторизация (откроется браузер)..."
npx @railway/cli login || { echo "❌ Ошибка авторизации"; exit 1; }
echo "✅ Авторизация успешна"

# Git
if [ ! -d ".git" ]; then
    echo ""
    echo "📁 Инициализирую Git..."
    git init
    git add .
    git commit -m "Initial commit: ZHKH Legal Assistant"
    echo "✅ Git создан"
fi

# Проект
echo ""
echo "🏗️  Создаю проект на Railway..."
npx @railway/cli init || { echo "❌ Ошибка"; exit 1; }
echo "✅ Проект создан"

# API ключ
echo ""
echo "═══════════════════════════════════════════════"
read -p "Anthropic API ключ (Enter для пропуска): " API_KEY

if [ -n "$API_KEY" ]; then
    npx @railway/cli variables set ANTHROPIC_API_KEY="$API_KEY"
    echo "✅ API ключ установлен"
else
    echo "⚠️  Оффлайн-режим"
fi

# Деплой
echo ""
echo "🚀 Деплою..."
npx @railway/cli up || { echo "❌ Ошибка деплоя"; exit 1; }

# Домен
echo ""
echo "🌐 Генерирую домен..."
npx @railway/cli domain

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ✅ Готово! Ссылка выше ☝️                  ║"
echo "╚══════════════════════════════════════════════╝"
