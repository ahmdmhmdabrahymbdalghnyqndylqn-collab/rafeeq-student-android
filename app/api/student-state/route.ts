import {env} from "cloudflare:workers";
import {studentId} from "../../student-session";
async function state(id:number){
 const [tasks,total]=await env.DB.batch([
  env.DB.prepare("SELECT id,subject,title,starts_at time,duration,status FROM schedules WHERE user_id=? ORDER BY starts_at,id").bind(id),
  env.DB.prepare("SELECT COALESCE(SUM(CAST(json_extract(meta,'$.minutes') AS INTEGER)),0) minutes FROM events WHERE user_id=? AND type='study_session'").bind(id)
 ]);
 return Response.json({tasks:tasks.results.map((r:any)=>({...r,done:r.status==="done"})),minutes:Number((total.results[0] as any)?.minutes||0),updatedAt:new Date().toISOString()},{headers:{"cache-control":"no-store"}});
}
export async function GET(request:Request){
 const id=await studentId(request);if(!id)return Response.json({error:"سجّل الدخول أولًا"},{status:401});
 try{return await state(id)}catch{return Response.json({error:"تعذر تحميل بياناتك. حاول مجددًا."},{status:503})}
}
export async function POST(request:Request){
 const id=await studentId(request);if(!id)return Response.json({error:"سجّل الدخول أولًا"},{status:401});
 if(request.headers.get("origin")&&request.headers.get("origin")!==new URL(request.url).origin)return new Response(null,{status:403});
 try{
  const b=await request.json() as any;
  if(b.action==="add"){
   if(!b.subject||!b.title||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time)||!Number.isInteger(b.duration)||Number(b.duration)<5||Number(b.duration)>240)return Response.json({error:"تحقق من المادة والوقت والمدة"},{status:400});
   await env.DB.prepare("INSERT INTO schedules(user_id,subject,title,starts_at,duration) VALUES(?,?,?,?,?)").bind(id,String(b.subject).slice(0,80),String(b.title).slice(0,160),b.time,Number(b.duration)).run();
  }else if(b.action==="toggle"){
   await env.DB.prepare("UPDATE schedules SET status=? WHERE id=? AND user_id=?").bind(b.done?"done":"pending",Number(b.id),id).run();
  }else if(b.action==="delete"){
   await env.DB.prepare("DELETE FROM schedules WHERE id=? AND user_id=?").bind(Number(b.id),id).run();
  }else if(b.action==="deleteMany"){
   if(!Array.isArray(b.ids)||!b.ids.length||b.ids.length>100)return new Response(null,{status:400});
   await env.DB.batch(b.ids.map((task:number)=>env.DB.prepare("DELETE FROM schedules WHERE id=? AND user_id=?").bind(Number(task),id)));
  }else if(b.action==="session"){
   if(!Number.isInteger(b.minutes)||b.minutes<1||b.minutes>240||typeof b.operation!=="string")return new Response(null,{status:400});
   await env.DB.prepare("INSERT INTO events(type,page,user_id,meta) SELECT 'study_session','study',?,? WHERE NOT EXISTS(SELECT 1 FROM events WHERE user_id=? AND type='study_session' AND json_extract(meta,'$.operation')=?)").bind(id,JSON.stringify({minutes:b.minutes,operation:b.operation}),id,b.operation).run();
  }else return new Response(null,{status:400});
  return await state(id);
 }catch{return Response.json({error:"تعذر حفظ التعديل. لم يتم تأكيد الحفظ؛ أعد المحاولة."},{status:503})}
}
