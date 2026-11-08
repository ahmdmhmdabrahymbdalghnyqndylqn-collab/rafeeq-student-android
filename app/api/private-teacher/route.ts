import { env } from "cloudflare:workers";
import { libraryCatalog } from "@/lib/library-catalog";

type WorkerEnv = {
  DB: D1Database;
  ADMIN_SESSION_SECRET: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
};

type Student = { id: number; name: string; country: string; track: string; language: string };
type HistoryItem = { role: "user" | "assistant"; content: string };
type TeacherRequest = {
  message?: unknown;
  subject?: unknown;
  unit?: unknown;
  history?: unknown;
};
type AIResponse = {
  success?: boolean;
  result?: { response?: string };
};

const E = env as unknown as WorkerEnv;
const encoder = new TextEncoder();
const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const MAX_MESSAGE_LENGTH = 1400;

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}

async function signed(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(E.ADMIN_SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function currentStudent(request: Request): Promise<Student | null> {
  const token = request.headers.get("cookie")?.match(/rafeeq_user=([^;]+)/)?.[1];
  if (!token) return null;
  const [id, expires, signature] = token.split(".");
  if (!id || !expires || !signature || Number(expires) < Date.now()) return null;
  if (signature !== await signed(`${id}.${expires}`)) return null;
  return E.DB.prepare("SELECT id,name,country,track,language FROM users WHERE id=?")
    .bind(Number(id))
    .first<Student>();
}

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function historyFrom(value: unknown): HistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-6)
    .flatMap((item): HistoryItem[] => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : null;
      const content = safeText(record.content, 900);
      return role && content ? [{ role, content }] : [];
    });
}

function relevantBooks(message: string, selectedSubject: string) {
  const query = normalize(message);
  const words = query.split(/\s+/).filter((word) => word.length > 2);
  return libraryCatalog
    .map((book) => {
      const title = normalize(book.title);
      const subject = normalize(book.subject);
      const score =
        (selectedSubject && book.subject === selectedSubject ? 8 : 0) +
        (query.includes(subject) ? 6 : 0) +
        words.reduce((total, word) => total + (title.includes(word) ? 2 : 0), 0);
      return { book, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title, "ar"))
    .slice(0, 4)
    .map(({ book }) => ({ id: book.id, title: book.title, subject: book.subject, pages: book.pages }));
}

function teacherInstructions(student: Student, subject: string, unit: string, books: ReturnType<typeof relevantBooks>) {
  const language = student.language === "en" ? "English" : "Arabic";
  const bookGuide = books.length
    ? books.map((book) => `- ${book.title} (${book.subject}, ${book.pages} صفحة)`).join("\n")
    : "لا يوجد كتاب محدد مطابق للسؤال؛ استخدم معرفتك التعليمية العامة بوضوح.";
  return `أنت «المعلم الخاص» في تطبيق رفيق الطالب. اكتب بلغة ${language} وبنبرة مدرس هادئة وواضحة ومشجعة. الطالب من ${student.country === "jordan" ? "الأردن" : "مصر"} ومساره ${student.track}.

ساعد في الفهم، الحل خطوة بخطوة، التنظيم، والتدريب. إذا طلب الطالب اختبارًا، أنشئ اختبارًا مناسبًا للمادة أو الوحدة: عنوان، تعليمات قصيرة، 5 إلى 10 أسئلة متنوعة، ثم «مفتاح الإجابة» في قسم منفصل أسفل الاختبار. لا تختلق صفحة أو اقتباسًا أو ادعاءً بأنك قرأت نصًا غير مرفق. استخدم دليل الكتب فقط لترشيح الكتب المناسبة، وقل بوضوح إن الإجابة العامة تحتاج الرجوع للكتاب عندما يعتمد السؤال على نص أو تمرين محدد.

المادة المختارة: ${subject || "غير محددة"}
الوحدة أو الدرس: ${unit || "غير محدد"}
كتب من مكتبة الطالب مرتبطة بالسؤال:
${bookGuide}`;
}

export async function POST(request: Request) {
  try {
    const student = await currentStudent(request);
    if (!student) return Response.json({ error: "سجّل الدخول لاستخدام المعلم الخاص." }, { status: 401 });

    const body = await request.json() as TeacherRequest;
    const message = safeText(body.message, MAX_MESSAGE_LENGTH);
    const subject = safeText(body.subject, 100);
    const unit = safeText(body.unit, 160);
    if (!message) return Response.json({ error: "اكتب سؤالك أولًا." }, { status: 400 });
    if (!E.CLOUDFLARE_API_TOKEN || !E.CLOUDFLARE_ACCOUNT_ID) {
      return Response.json({ error: "المعلم الخاص غير مهيأ بعد." }, { status: 503 });
    }

    const books = relevantBooks(message, subject);
    const messages = [
      { role: "system", content: teacherInstructions(student, subject, unit, books) },
      ...historyFrom(body.history),
      { role: "user", content: message },
    ];
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${E.CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${E.CLOUDFLARE_API_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ messages, max_tokens: 850, temperature: 0.35 }),
      },
    );
    const result = await response.json() as AIResponse;
    const answer = result.success ? safeText(result.result?.response, 7000) : "";
    if (!response.ok || !answer) {
      console.error("private teacher request failed", response.status);
      return Response.json({ error: "تعذر وصول المعلم الخاص الآن. حاول مجددًا بعد قليل." }, { status: 503 });
    }

    try {
      await E.DB.prepare("INSERT INTO events(type,page,user_id,meta) VALUES('private_teacher','teacher',?,?)")
        .bind(student.id, JSON.stringify({ subject, unit, bookIds: books.map((book) => book.id) }))
        .run();
    } catch {
      console.error("private teacher analytics unavailable");
    }
    return Response.json({ answer, books });
  } catch (error) {
    console.error("private teacher route failed", error);
    return Response.json({ error: "تعذر تجهيز إجابة المعلم الخاص. حاول مجددًا." }, { status: 500 });
  }
}
