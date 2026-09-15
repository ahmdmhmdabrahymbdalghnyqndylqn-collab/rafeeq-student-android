import{env}from"cloudflare:workers";const E=env as unknown as Record<string,any>;
async function serve(req:Request,head=false){
 const u=new URL(req.url),key=u.searchParams.get("key");
 try{
  if(!key){const rows=await E.DB.prepare("SELECT id,title,subject,country,object_key objectKey,size,pages FROM books ORDER BY title").all();return Response.json({books:rows.results},{headers:{"cache-control":"no-store"}})}
  const book=await E.DB.prepare("SELECT title FROM books WHERE object_key=? LIMIT 1").bind(key).first();
  if(!book)return new Response("Not found",{status:404});
  const metadata=await E.BOOKS.head(key);if(!metadata)return new Response("Not found",{status:404});
  const h=new Headers({"content-type":"application/pdf","accept-ranges":"bytes","etag":metadata.httpEtag,"x-content-type-options":"nosniff","cache-control":"private, max-age=3600","content-disposition":`${u.searchParams.get("download")==="1"?"attachment":"inline"}; filename*=UTF-8''${encodeURIComponent(book.title+".pdf")}`});
  let offset=0,length=metadata.size,status=200;
  const range=req.headers.get("range");
  if(range&&!head){
   const m=/^bytes=(\d*)-(\d*)$/.exec(range);
   if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{"content-range":`bytes */${metadata.size}`}});
   offset=m[1]?Number(m[1]):Math.max(0,metadata.size-Number(m[2]));
   const end=m[1]&&m[2]?Math.min(Number(m[2]),metadata.size-1):metadata.size-1;
   if(!Number.isSafeInteger(offset)||offset>=metadata.size||end<offset)return new Response(null,{status:416,headers:{"content-range":`bytes */${metadata.size}`}});
   length=end-offset+1;status=206;h.set("content-range",`bytes ${offset}-${end}/${metadata.size}`);
  }
  h.set("content-length",String(length));
  if(head)return new Response(null,{headers:h});
  const obj=await E.BOOKS.get(key,status===206?{range:{offset,length}}:undefined);
  if(!obj)return new Response("Not found",{status:404});
  return new Response(obj.body,{status,headers:h});
 }catch{return Response.json({error:"تعذر تحميل المكتبة. حاول مجددًا."},{status:503})}
}
export async function GET(req:Request){return serve(req)}
export async function HEAD(req:Request){return serve(req,true)}
export async function POST(req:Request){if(req.headers.get("x-upload-secret")!==String(E.ADMIN_SESSION_SECRET))return Response.json({error:"Unauthorized"},{status:401});const u=new URL(req.url),action=u.searchParams.get("action"),key=u.searchParams.get("key")||"";if(!key)return Response.json({error:"key required"},{status:400});if(action==="init"){const upload=await E.BOOKS.createMultipartUpload(key,{httpMetadata:{contentType:"application/pdf"}});return Response.json({uploadId:upload.uploadId,key})}if(action==="part"){const upload=E.BOOKS.resumeMultipartUpload(key,u.searchParams.get("uploadId"));const part=await upload.uploadPart(Number(u.searchParams.get("partNumber")),await req.arrayBuffer());return Response.json(part)}if(action==="complete"){const b=await req.json() as any;const upload=E.BOOKS.resumeMultipartUpload(key,b.uploadId);await upload.complete(b.parts);await E.DB.prepare("INSERT INTO books(title,subject,country,object_key,size,pages) VALUES(?,?,?,?,?,?)").bind(b.title,b.subject||"عام",b.country||"egypt",key,b.size||0,b.pages||0).run();return Response.json({ok:true})}return Response.json({error:"invalid action"},{status:400})}
