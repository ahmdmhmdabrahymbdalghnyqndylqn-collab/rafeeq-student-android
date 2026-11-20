const CHAT_MODEL = "@cf/qwen/qwen3.8-27b";
const EMBEDDING_MODEL = "@cf/baai/bge-m3";
const MAX_MESSAGE_LENGTH = 1400;
const MAX_CONTEXT_CHARS = 7200;
const MAX_INGEST_ITEMS = 30;
const MAX_INGEST_TEXT = 4200;
const MAX_REQUESTS_PER_HOUR = 30;

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-rafeeq-ingest-key",
    "content-type": "application/json; charset=utf-8",
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: corsHeaders() });
}

function text(value, max = MAX_MESSAGE_LENGTH) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function history(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-6).flatMap((message) => {
    const role = message?.role === "assistant" ? "assistant" : message?.role === "user" ? "user" : null;
    const content = text(message?.content, 900);
    return role && content ? [{ role, content }] : [];
  });
}

async function embedding(env, value) {
  const output = await env.AI.run(EMBEDDING_MODEL, { text: [value] });
  const vector = output?.data?.[0] ?? output?.data ?? output?.[0];
  if (!Array.isArray(vector) || vector.length !== 1024) throw new Error("Embedding response is invalid.");
  return vector;
}

async function embeddings(env, values) {
  const output = await env.AI.run(EMBEDDING_MODEL, { text: values });
  const vectors = output?.data;
  if (!Array.isArray(vectors) || vectors.length !== values.length || vectors.some((vector) => !Array.isArray(vector) || vector.length !== 1024)) {
    throw new Error("Embedding response is invalid.");
  }
  return vectors;
}

async function rateLimit(request, env) {
  const key = request.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  const windowStart = now - (now % 3600000);
  const row = await env.DB.prepare("SELECT window_start, count FROM rate_limits WHERE client_key = ?").bind(key).first();
  if (!row || Number(row.window_start) !== windowStart) {
    await env.DB.prepare(
      "INSERT INTO rate_limits (client_key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(client_key) DO UPDATE SET window_start = excluded.window_start, count = 1",
    ).bind(key, windowStart).run();
    return;
  }
  if (Number(row.count) >= MAX_REQUESTS_PER_HOUR) {
    const error = new Error("RATE_LIMITED");
    error.code = "RATE_LIMITED";
    throw error;
  }
  await env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE client_key = ?").bind(key).run();
}

async function relevantChunks(env, question, subject) {
  const vector = await embedding(env, question);
  const matches = await env.VECTOR_INDEX.query(vector, {
    topK: 6,
    returnMetadata: "all",
    ...(subject ? { filter: { subject } } : {}),
  });
  const ids = (matches.matches || []).map((match) => String(match.id)).filter(Boolean);
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const result = await env.DB.prepare(
    `SELECT id, book_title, subject, page, text FROM book_chunks WHERE id IN (${placeholders})`,
  ).bind(...ids).all();
  const rank = new Map(ids.map((id, index) => [id, index]));
  return (result.results || []).sort((a, b) => rank.get(a.id) - rank.get(b.id));
}

function systemPrompt(subject, unit, chunks) {
  const references = chunks.length
    ? chunks.map((chunk) => `[${chunk.book_title} - صفحة ${chunk.page}]\n${chunk.text}`).join("\n\n")
    : "لا يوجد مقطع مفهرس مطابق للسؤال.";
  return `أنت «المعلم الخاص» في تطبيق رفيق الطالب للثانوية. تكلّم بالعربية الواضحة، بنبرة ودودة ومهنية، ولا تكرر نفسك.

المادة المختارة: ${subject || "غير محددة"}
الدرس أو الوحدة: ${unit || "غير محدد"}

قواعدك:
1) استخدم المقاطع المرجعية عندما تكون مرتبطة بالسؤال. لا تختلق اقتباسًا أو رقم صفحة.
2) إن لم تكن المراجع كافية، صرّح بذلك ثم قدّم شرحًا عامًا واضحًا واطلب اسم الدرس أو صورة السؤال.
3) عند طلب اختبار، أنشئ 5 أسئلة متنوعة مناسبة للمادة، ثم «مفتاح الإجابة» منفصلًا في النهاية.
4) في المسائل، اشرح الخطوات ولا تكتفِ بالإجابة النهائية.
5) اجعل الإجابة منظمة وقصيرة ما أمكن.

المقاطع المرجعية:
${references}`;
}

async function chat(request, env) {
  const body = await request.json();
  const message = text(body.message);
  const subject = text(body.subject, 100);
  const unit = text(body.unit, 160);
  if (!message) return json({ error: "اكتب سؤالك أولًا." }, 400);

  await rateLimit(request, env);
  const chunks = await relevantChunks(env, message, subject);
  const output = await env.AI.run(CHAT_MODEL, {
    messages: [
      { role: "system", content: systemPrompt(subject, unit, chunks) },
      ...history(body.history),
      { role: "user", content: message },
    ],
    max_tokens: 850,
    temperature: 0.25,
    repetition_penalty: 1.08,
  });
  const answer = text(output?.response ?? output?.choices?.[0]?.message?.content, 7000);
  if (!answer) throw new Error("Model response is empty.");
  const sources = [...new Map(chunks.map((chunk) => {
    const source = { title: chunk.book_title, subject: chunk.subject, page: chunk.page };
    return [`${source.title}:${source.page}`, source];
  })).values()];
  return json({
    answer,
    sources,
  });
}

function sameSecret(received, expected) {
  if (!received || !expected || received.length !== expected.length) return false;
  let result = 0;
  for (let index = 0; index < received.length; index += 1) result |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return result === 0;
}

function ingestChunk(value) {
  const id = text(value?.id, 120);
  const bookId = Number(value?.bookId);
  const title = text(value?.title, 220);
  const subject = text(value?.subject, 100);
  const page = Number(value?.page);
  const content = text(value?.text, MAX_INGEST_TEXT);
  if (!id || !Number.isInteger(bookId) || !title || !subject || !Number.isInteger(page) || page < 1 || !content) return null;
  return { id, bookId, title, subject, page, text: content };
}

async function ingest(request, env) {
  if (!sameSecret(request.headers.get("x-rafeeq-ingest-key"), env.INGEST_KEY)) return json({ error: "Unauthorized." }, 401);
  const body = await request.json();
  const chunks = Array.isArray(body?.chunks) ? body.chunks.map(ingestChunk).filter(Boolean).slice(0, MAX_INGEST_ITEMS) : [];
  if (!chunks.length) return json({ error: "No valid chunks supplied." }, 400);

  const vectors = await embeddings(env, chunks.map((chunk) => chunk.text));
  await env.DB.batch(chunks.map((chunk) => env.DB.prepare(
    "INSERT INTO book_chunks (id, book_id, book_title, subject, page, text) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET book_id = excluded.book_id, book_title = excluded.book_title, subject = excluded.subject, page = excluded.page, text = excluded.text",
  ).bind(chunk.id, chunk.bookId, chunk.title, chunk.subject, chunk.page, chunk.text)));
  await env.VECTOR_INDEX.upsert(chunks.map((chunk, index) => ({
    id: chunk.id,
    values: vectors[index],
    metadata: { bookId: chunk.bookId, title: chunk.title, subject: chunk.subject, page: chunk.page },
  })));
  return json({ indexed: chunks.length });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, service: "rafeeq-private-teacher" });
    if (request.method !== "POST") return json({ error: "Not found." }, 404);
    try {
      if (url.pathname === "/ingest") return await ingest(request, env);
      if (url.pathname !== "/chat") return json({ error: "Not found." }, 404);
      return await chat(request, env);
    } catch (error) {
      console.error("teacher request failed", error);
      if (error?.code === "RATE_LIMITED") return json({ error: "لقد وصلت إلى الحد المؤقت للرسائل. جرّب خلال ساعة." }, 429);
      return json({ error: "تعذر تجهيز إجابة المعلم الآن. حاول بعد قليل." }, 503);
    }
  },
};
