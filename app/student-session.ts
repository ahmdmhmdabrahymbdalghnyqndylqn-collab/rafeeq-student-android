import {env} from "cloudflare:workers";
export async function studentId(request:Request):Promise<number|null>{
 const token=request.headers.get("cookie")?.match(/(?:^|;\s*)rafeeq_user=([^;]+)/)?.[1];
 if(!token)return null;
 const [id,expires,signature]=token.split(".");
 if(!/^\d+$/.test(id)||!Number.isFinite(Number(expires))||Number(expires)<=Date.now())return null;
 const secret=(env as unknown as Record<string,string>).ADMIN_SESSION_SECRET;
 if(!secret)return null;
 const enc=new TextEncoder(),key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signed=await crypto.subtle.sign("HMAC",key,enc.encode(id+"."+expires));
 const expected=btoa(String.fromCharCode(...new Uint8Array(signed))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
 if(signature!==expected)return null;
 return (await env.DB.prepare("SELECT id FROM users WHERE id=?").bind(Number(id)).first())?Number(id):null;
}
