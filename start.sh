#!/bin/bash

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   🏠 Установка Ассистента ЖКХ + Право        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден!"
    echo "   Установите: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js найден: $(node -v)"

# Установка зависимостей
echo ""
echo "📦 Устанавливаю зависимости..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Ошибка установки"
    exit 1
fi
echo "✅ Зависимости установлены"

# Запрос API ключа
echo ""
echo "═══════════════════════════════════════════════"
echo " Для полноценной работы нужен API ключ Anthropic"
echo " Получить: https://console.anthropic.com"
echo " (Можно пропустить — будет работать оффлайн)"
echo "═══════════════════════════════════════════════"
echo ""
read -p "Вставьте API ключ (или нажмите Enter для пропуска): " API_KEY

if [ -n "$API_KEY" ]; then
    echo "ANTHROPIC_API_KEY=$API_KEY" > .env
    echo "PORT=3000" >> .env
    echo "MODEL=claude-sonnet-4-20250514" >> .env
    echo "✅ API ключ сохранён в .env"
else
    echo "PORT=3000" > .env
    echo "MODEL=claude-sonnet-4-20250514" >> .env
    echo "⚠️  Работаю без API ключа (оффлайн-режим)"
fi

# Запуск
echo ""
echo "🚀 Запускаю сервер..."
echo "   Откройте в браузере: http://localhost:3000"
echo "   Для остановки нажмите Ctrl+C"
echo ""

# Загрузка .env
export $(cat .env | xargs)
node server.js
