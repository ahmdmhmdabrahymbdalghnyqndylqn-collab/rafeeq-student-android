import {readFile,open,stat,mkdir,writeFile} from 'node:fs/promises';
const base='https://rafeeq-student.satins-mantis-1w.chatgpt.site';
const env=await readFile('.dev.vars','utf8');
const secret=env.match(/^ADMIN_SESSION_SECRET\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g,'');
if(!secret)throw Error('Upload credential is unavailable');
const rows=JSON.parse(await readFile('output/pdf/manifest.json','utf8'));
await mkdir('output/uploads',{recursive:true});
const stateFile='output/uploads/state.json';
let state={};try{state=JSON.parse(await readFile(stateFile,'utf8'))}catch{}
async function save(){await writeFile(stateFile,JSON.stringify(state,null,2))}
async function request(url,body,json=false){
 for(let attempt=0;attempt<4;attempt++){
  try{const r=await fetch(base+url,{method:'POST',headers:{'x-upload-secret':secret,...(json?{'content-type':'application/json'}:{})},body:json?JSON.stringify(body):body,signal:AbortSignal.timeout(180000)});
   if(!r.ok){if(r.status===401||r.status===403)throw Error('UPLOAD_NOT_AUTHORIZED');if(r.status<500&&r.status!==429)throw Error('UPLOAD_REJECTED_'+r.status);throw Error('HTTP_'+r.status)}
   return await r.json();
  }catch(e){if(attempt===3||/AUTHORIZED|REJECTED/.test(e.message))throw e;await new Promise(r=>setTimeout(r,3000*(attempt+1)))}
 }
}
const listed=await fetch(base+'/api/books').then(r=>r.json());
const existing=new Set((listed.books||[]).map(b=>b.objectKey));
for(const row of rows){
 if(existing.has(row.objectKey)){console.log('Already available: '+row.id);continue}
 const size=(await stat(row.source)).size;
 let upload=state[row.id];
 if(!upload){upload=await request('/api/books?action=init&key='+encodeURIComponent(row.objectKey));upload.parts=[];state[row.id]=upload;await save()}
 const file=await open(row.source,'r');const chunkSize=8*1024*1024;
 try{
  for(let offset=0,partNumber=1;offset<size;offset+=chunkSize,partNumber++){
   if(upload.parts.some(p=>p.partNumber===partNumber))continue;
   const buffer=Buffer.alloc(Math.min(chunkSize,size-offset));
   const {bytesRead}=await file.read(buffer,0,buffer.length,offset);
   if(bytesRead!==buffer.length)throw Error('Incomplete source read');
   const part=await request('/api/books?action=part&key='+encodeURIComponent(row.objectKey)+'&uploadId='+encodeURIComponent(upload.uploadId)+'&partNumber='+partNumber,buffer);
   upload.parts.push(part);await save();
   console.log('Book '+row.id+'/51: '+Math.round((offset+bytesRead)/size*100)+'%');
  }
 }finally{await file.close()}
 await request('/api/books?action=complete&key='+encodeURIComponent(row.objectKey),{...row,title:row.title.replaceAll('_',' '),size,uploadId:upload.uploadId,parts:upload.parts},true);
 upload.complete=true;await save();console.log('AVAILABLE '+row.id+' '+size);
}
console.log('ALL 51 FILES UPLOADED');
