const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// Загрузка .env файла (для локального запуска, Railway устанавливает переменные автоматически)
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        const val = trimmed.slice(eqIndex + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
  console.log("📄 Загружен .env файл");
}

const app = express();
app.use(cors());
app.use(express.json());
// Статические файлы: ищем в public/, если нет — в корне
const publicDir = fs.existsSync(path.join(__dirname, "public"))
  ? path.join(__dirname, "public")
  : __dirname;
app.use(express.static(publicDir));

// ═══════════════════════════════════════════════
// Загрузка базы знаний
// ═══════════════════════════════════════════════
// Ищем knowledge_base.json в нескольких местах
const kbPaths = [
  path.join(__dirname, "data", "knowledge_base.json"),
  path.join(__dirname, "knowledge_base.json"),
];
const kbPath = kbPaths.find(p => fs.existsSync(p));
if (!kbPath) {
  console.error("❌ Файл knowledge_base.json не найден! Проверьте структуру проекта.");
  process.exit(1);
}
const KB = JSON.parse(fs.readFileSync(kbPath, "utf-8"));
console.log(`📚 База знаний загружена: ${KB.length} вопросов`);

// ═══════════════════════════════════════════════
// Поисковый движок (keyword + partial match)
// ═══════════════════════════════════════════════
const STOP_WORDS = new Set([
  "и","в","на","по","с","к","о","из","за","от","для","не","что","как",
  "это","то","при","или","но","а","его","её","их","все","был","она",
  "он","мы","вы","ли","бы","же","ни","до","об","без","так","уже",
  "ещё","нет","да","ст","рф","какие","какой","каков","какова","каковы"
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[«»"".,;:!?()—–\-\/\\№]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function search(query, mode = "all", topN = 5) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  return KB
    .filter(item => mode === "all" || item.t === mode)
    .map(item => {
      const itemTokens = tokenize(item.q + " " + item.a);
      let score = 0;
      for (const t of tokens) {
        for (const it of itemTokens) {
          if (it === t) score += 3;
          else if (it.startsWith(t) || t.startsWith(it)) score += 2;
          else if (it.includes(t) || t.includes(it)) score += 1;
        }
      }
      return { ...item, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

// ═══════════════════════════════════════════════
// API: Поиск по базе знаний
// ═══════════════════════════════════════════════
app.post("/api/search", (req, res) => {
  const { query, mode } = req.body;
  const results = search(query || "", mode || "all");
  res.json({ results });
});

// ═══════════════════════════════════════════════
// API: Чат с Claude (RAG)
// ═══════════════════════════════════════════════
app.post("/api/chat", async (req, res) => {
  const { message, mode, history } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: "Сообщение не может быть пустым" });
  }

  // 1. Поиск контекста
  const context = search(message, mode || "all", 5);

  // 2. Формирование промпта
  const modeLabels = {
    all: "правовая система РФ, ЖКХ и банковское обслуживание фондов капремонта",
    l: "правовая система РФ и ЖКХ",
    b: "банковское обслуживание фондов капремонта"
  };

  const systemPrompt = `Ты — профессиональный AI-ассистент по теме: ${modeLabels[mode] || modeLabels.all}.

ПРАВИЛА:
- Отвечай на русском языке
- Используй предоставленный контекст из базы знаний для формирования ответа
- Если контекст содержит релевантную информацию — обязательно ссылайся на конкретные статьи и нормативные акты
- Если контекст не покрывает вопрос полностью — дополни своими знаниями, но явно отметь: «Дополнительно (вне базы знаний):»
- Отвечай структурированно, по существу, без воды
- Не повторяй вопрос пользователя`;

  const contextBlock = context.length > 0
    ? "КОНТЕКСТ ИЗ БАЗЫ ЗНАНИЙ:\n\n" + context.map((c, i) =>
        `[${i + 1}] Вопрос: ${c.q}\nОтвет: ${c.a}\nНорм. акт: ${c.r}`
      ).join("\n\n")
    : "В базе знаний не найдено релевантного контекста. Отвечай на основе своих знаний, отметив это.";

  // 3. Формирование сообщений с историей
  const messages = [];
  
  // Добавляем последние 6 сообщений из истории для контекста
  if (history && history.length > 0) {
    const recent = history.slice(-6);
    for (const h of recent) {
      messages.push({ role: h.role, content: h.text });
    }
  }

  messages.push({
    role: "user",
    content: `${contextBlock}\n\n---\nВОПРОС: ${message}`
  });

  // 4. Проверка API ключа
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.json({
      answer: formatOfflineAnswer(context, message),
      sources: context,
      offline: true
    });
  }

  // 5. Вызов Claude API
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: process.env.MODEL || "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: systemPrompt,
        messages
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("Claude API Error:", data.error);
      return res.json({
        answer: formatOfflineAnswer(context, message),
        sources: context,
        offline: true,
        apiError: data.error.message
      });
    }

    const answer = data.content?.map(item => item.text || "").join("\n") || "Ошибка получения ответа";
    
    res.json({
      answer,
      sources: context,
      offline: false,
      model: data.model,
      usage: data.usage
    });
  } catch (err) {
    console.error("Fetch error:", err.message);
    res.json({
      answer: formatOfflineAnswer(context, message),
      sources: context,
      offline: true,
      apiError: err.message
    });
  }
});

// Оффлайн-ответ из базы знаний (без API)
function formatOfflineAnswer(context, query) {
  if (context.length === 0) {
    return "К сожалению, в базе знаний не найдено релевантной информации по вашему запросу. Попробуйте переформулировать вопрос.";
  }

  let answer = "📋 **Результаты из базы знаний:**\n\n";
  for (const c of context) {
    answer += `**${c.q}**\n${c.a}\n📌 _${c.r}_\n\n`;
  }
  answer += "---\n_⚠️ Режим оффлайн: ответ сформирован напрямую из базы знаний без обработки Claude API. Установите ANTHROPIC_API_KEY для полноценных ответов._";
  return answer;
}

// ═══════════════════════════════════════════════
// API: Статистика базы знаний
// ═══════════════════════════════════════════════
app.get("/api/stats", (req, res) => {
  const legal = KB.filter(i => i.t === "l").length;
  const banking = KB.filter(i => i.t === "b").length;
  res.json({
    total: KB.length,
    legal,
    banking,
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    model: process.env.MODEL || "claude-sonnet-4-20250514"
  });
});

// ═══════════════════════════════════════════════
// API: Список всех вопросов (для навигации)
// ═══════════════════════════════════════════════
app.get("/api/questions", (req, res) => {
  const mode = req.query.mode || "all";
  const questions = KB
    .filter(item => mode === "all" || item.t === mode)
    .map(item => ({ q: item.q, r: item.r, t: item.t }));
  res.json({ questions });
});

// Health check для Railway
app.get("/health", (req, res) => {
  res.json({ status: "ok", kb: KB.length, uptime: process.uptime() });
});

// SPA fallback
const indexPath = fs.existsSync(path.join(__dirname, "public", "index.html"))
  ? path.join(__dirname, "public", "index.html")
  : path.join(__dirname, "index.html");
app.get("*", (req, res) => {
  res.sendFile(indexPath);
});

// ═══════════════════════════════════════════════
// Запуск
// ═══════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("");
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║    🏠 Ассистент ЖКХ + Право запущен!         ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  🌐 http://localhost:${PORT}                     ║`);
  console.log(`║  📚 База знаний: ${KB.length} вопросов              ║`);
  console.log(`║  🔑 API ключ: ${process.env.ANTHROPIC_API_KEY ? "✅ установлен" : "❌ не установлен"}           ║`);
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("⚠️  Для работы с Claude API установите переменную:");
    console.log("   export ANTHROPIC_API_KEY=sk-ant-...");
    console.log("   Без ключа — работает в оффлайн-режиме (поиск по базе)");
    console.log("");
  }
});
