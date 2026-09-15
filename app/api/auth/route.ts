import { env } from "cloudflare:workers";

const E = env as unknown as Record<string, any>;
const encoder = new TextEncoder();

async function sign(value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(E.ADMIN_SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function hashPassword(password: string, salt = crypto.randomUUID()) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 50_000 }, key, 256);
  return `${salt}:${Array.from(new Uint8Array(bits)).map(x => x.toString(16).padStart(2, "0")).join("")}`;
}

async function currentUser(request: Request) {
  const token = request.headers.get("cookie")?.match(/rafeeq_user=([^;]+)/)?.[1];
  if (!token) return null;
  const [id, expires, signature] = token.split(".");
  if (Number(expires) < Date.now() || signature !== await sign(`${id}.${expires}`)) return null;
  return E.DB.prepare("SELECT id,name,email,country,track,language FROM users WHERE id=?").bind(Number(id)).first();
}

async function sessionCookie(id: number) {
  const expires = String(Date.now() + 2_592_000_000);
  return `rafeeq_user=${id}.${expires}.${await sign(`${id}.${expires}`)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`;
}

export async function GET(request: Request) {
  try { return Response.json({ user: await currentUser(request) }); }
  catch { return Response.json({ user: null }); }
}

export async function POST(request: Request) {
  const body = await request.json() as any;
  const email = String(body.email || "").trim().toLowerCase();

  if (body.action === "register") {
    if (!String(body.name || "").trim() || !email || String(body.password || "").length < 8) {
      return Response.json({ error: "أكمل البيانات واستخدم كلمة مرور من 8 أحرف على الأقل" }, { status: 400 });
    }
    try {
      const existing = await E.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
      if (existing) return Response.json({ error: "هذا البريد مسجل بالفعل. اختر تسجيل الدخول." }, { status: 409 });

      const passwordHash = await hashPassword(String(body.password));
      const result = await E.DB.prepare("INSERT INTO users(name,email,password_hash,country,track,language) VALUES(?,?,?,?,?,'ar')")
        .bind(String(body.name).trim(), email, passwordHash, body.country || "egypt", body.track || "science").run();
      const id = Number(result.meta.last_row_id);
      const user = await E.DB.prepare("SELECT id,name,email,country,track,language FROM users WHERE id=?").bind(id).first();
      if (!user) throw new Error("USER_CREATE_READBACK_FAILED");
      await E.DB.prepare("INSERT INTO events(type,page,user_id) VALUES('registration','auth',?)").bind(id).run();
      return new Response(JSON.stringify({ user }), { status: 201, headers: { "content-type": "application/json", "set-cookie": await sessionCookie(id) } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("student registration failed", message);
      if (/unique|constraint/i.test(message)) return Response.json({ error: "هذا البريد مسجل بالفعل. اختر تسجيل الدخول." }, { status: 409 });
      try { await E.DB.prepare("INSERT INTO errors(message,page,severity,device) VALUES(?,?,?,?)").bind(`Registration: ${message}`.slice(0, 1000), "auth", "high", request.headers.get("user-agent") || "unknown").run(); } catch {}
      return Response.json({ error: "تعذر إنشاء الحساب الآن. حاول مرة أخرى بعد لحظات." }, { status: 500 });
    }
  }

  if (body.action === "login") {
    try {
      const user = await E.DB.prepare("SELECT id,name,email,country,track,language,password_hash FROM users WHERE email=?").bind(email).first();
      if (!user) return Response.json({ error: "البريد أو كلمة المرور غير صحيحة" }, { status: 401 });
      const salt = String(user.password_hash).split(":")[0];
      if (await hashPassword(String(body.password), salt) !== user.password_hash) return Response.json({ error: "البريد أو كلمة المرور غير صحيحة" }, { status: 401 });
      delete user.password_hash;
      return new Response(JSON.stringify({ user }), { headers: { "content-type": "application/json", "set-cookie": await sessionCookie(Number(user.id)) } });
    } catch (error) {
      console.error("student login failed", error);
      return Response.json({ error: "تعذر تسجيل الدخول الآن. حاول مرة أخرى." }, { status: 500 });
    }
  }
  return Response.json({ error: "طلب غير صالح" }, { status: 400 });
}
