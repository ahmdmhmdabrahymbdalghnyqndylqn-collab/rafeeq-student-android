import assert from 'node:assert/strict';
const base='http://localhost:5173';
async function request(path,body,cookie){return fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})})}
assert.equal((await request('/api/student-state')).status,401);
async function register(){const r=await request('/api/auth',{action:'register',name:'QA local',email:crypto.randomUUID()+'@example.test',password:crypto.randomUUID(),country:'egypt',track:'science'});assert.equal(r.status,201,await r.text());return r.headers.get('set-cookie').split(';')[0]}
const a=await register(),b=await register();
let r=await request('/api/student-state',null,a);assert.equal(r.status,200);assert.deepEqual((await r.json()).tasks,[]);
r=await request('/api/student-state',{action:'add',subject:'الفيزياء',title:'اختبار محلي',time:'17:00',duration:45},a);assert.equal(r.status,200);let state=await r.json();assert.equal(state.tasks.length,1);const id=state.tasks[0].id;
r=await request('/api/student-state',{action:'toggle',id,done:true},b);assert.equal(r.status,200);assert.deepEqual((await r.json()).tasks,[]);
state=await (await request('/api/student-state',null,a)).json();assert.equal(state.tasks[0].done,false);
await request('/api/student-state',{action:'toggle',id,done:true},a);
state=await (await request('/api/student-state',null,a)).json();assert.equal(state.tasks[0].done,true);
assert.equal((await request('/api/student-state',{action:'add',subject:'x',title:'x',time:'29:70',duration:45},a)).status,400);
const operation=crypto.randomUUID();for(let i=0;i<2;i++)assert.equal((await request('/api/student-state',{action:'session',minutes:25,operation},a)).status,200);
state=await (await request('/api/student-state',null,a)).json();assert.equal(state.minutes,25);
await request('/api/student-state',{action:'deleteMany',ids:[id]},a);
state=await (await request('/api/student-state',null,a)).json();assert.equal(state.tasks.length,0);
console.log('PASS: local registration, authenticated state, durable CRUD, account isolation, time validation, idempotent sessions.');
