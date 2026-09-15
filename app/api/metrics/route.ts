import { env } from "cloudflare:workers";

const E = env as unknown as Record<string, any>;
const encoder = new TextEncoder();

async function isAdmin(request: Request) {
  const token = request.headers.get("cookie")?.match(/rafeeq_admin=([^;]+)/)?.[1];
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (Number(expires) < Date.now()) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(E.ADMIN_SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(expires));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return signature === expected;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as any;
    await env.DB.prepare("INSERT INTO events(type,page,meta) VALUES(?,?,?)").bind(String(body.type || "page_view"), String(body.page || "unknown"), JSON.stringify(body.meta || {})).run();
    return Response.json({ ok: true });
  } catch { return Response.json({ ok: true, offline: true }); }
}

export async function GET(request: Request) {
  if (!await isAdmin(request)) return Response.json({ error: "غير مصرح" }, { status: 401 });
  try {
    const [totals, pages, recentErrors, userCount, studentRows] = await env.DB.batch([
      env.DB.prepare("SELECT type,COUNT(*) count FROM events GROUP BY type"),
      env.DB.prepare("SELECT page,COUNT(*) count FROM events WHERE type='page_view' GROUP BY page ORDER BY count DESC"),
      env.DB.prepare("SELECT * FROM errors ORDER BY created_at DESC LIMIT 20"),
      env.DB.prepare("SELECT COUNT(*) count FROM users"),
      env.DB.prepare("SELECT id,name,email,country,track,created_at createdAt FROM users ORDER BY created_at DESC LIMIT 100"),
    ]);
    const eventMap = Object.fromEntries((totals.results as any[]).map(x => [x.type, Number(x.count)]));
    return Response.json({ totals: totals.results, pages: pages.results, errors: recentErrors.results, users: studentRows.results, summary: { users: Number((userCount.results[0] as any)?.count || 0), views: (pages.results as any[]).reduce((sum, x) => sum + Number(x.count), 0), installs: eventMap.install || 0, active: eventMap.app_open || 0, completed: eventMap.task_completed || 0, sessions: eventMap.study_session || 0 } });
  } catch { return Response.json({ totals: [], pages: [], errors: [], users: [], summary: { users: 0, views: 0, installs: 0, active: 0, completed: 0, sessions: 0 } }); }
}
