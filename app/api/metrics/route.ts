import {studentId} from "../../student-session";
import { env } from "cloudflare:workers";

const E = env as unknown as Record<string, any>;
const encoder = new TextEncoder();

async function isAdmin(request: Request) {
  const token = request.headers.get("cookie")?.match(/rafeeq_admin=([^;]+)/)?.[1];
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!Number.isFinite(Number(expires)) || Number(expires) < Date.now()) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(E.ADMIN_SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(expires));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return signature === expected;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as any;
    if(!["page_view","app_open","install","book_read","book_download"].includes(body.type))return Response.json({error:"Invalid event"},{status:400});
    const id=await studentId(request);
    await env.DB.prepare("INSERT INTO events(type,page,user_id,meta) VALUES(?,?,?,?)").bind(body.type, String(body.page || "unknown").slice(0,80),id,JSON.stringify({})).run();
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "تعذر تسجيل الحدث" },{status:503}); }
}

export async function GET(request: Request) {
  if (!await isAdmin(request)) return Response.json({ error: "غير مصرح" }, { status: 401 });
  try {
    const [totals, pages, recentErrors, userCount, studentRows, scheduleStats, bookStats] = await env.DB.batch([
      env.DB.prepare("SELECT type,COUNT(*) count FROM events GROUP BY type"),
      env.DB.prepare("SELECT page,COUNT(*) count FROM events WHERE type='page_view' GROUP BY page ORDER BY count DESC"),
      env.DB.prepare("SELECT * FROM errors ORDER BY created_at DESC LIMIT 20"),
      env.DB.prepare("SELECT COUNT(*) count FROM users"),
      env.DB.prepare("SELECT id,name,email,country,track,created_at createdAt FROM users ORDER BY created_at DESC LIMIT 100"),
      env.DB.prepare("SELECT COUNT(*) tasks,COUNT(DISTINCT user_id) plans,COALESCE(SUM(status='done'),0) completed FROM schedules"),
      env.DB.prepare("SELECT COUNT(*) books FROM books"),
    ]);
    const eventMap = Object.fromEntries((totals.results as any[]).map(x => [x.type, Number(x.count)]));
    return Response.json({ updatedAt:new Date().toISOString(), totals: totals.results, pages: pages.results, errors: recentErrors.results, users: studentRows.results, summary: { users: Number((userCount.results[0] as any)?.count || 0), views: (pages.results as any[]).reduce((sum, x) => sum + Number(x.count), 0), installs: eventMap.install || 0, active: eventMap.app_open || 0, completed: Number((scheduleStats.results[0] as any)?.completed||0), plans:Number((scheduleStats.results[0] as any)?.plans||0), tasks:Number((scheduleStats.results[0] as any)?.tasks||0), books:Number((bookStats.results[0] as any)?.books||0), reads:eventMap.book_read||0, downloads:eventMap.book_download||0, sessions: eventMap.study_session || 0 } },{headers:{"cache-control":"no-store"}});
  } catch { return Response.json({ error:"تعذر تحديث البيانات" },{status:503}); }
}
