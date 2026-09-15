"use client";
import Image from "next/image";
import {useEffect,useState} from "react";
import {ChevronLeft} from "lucide-react";
import Workspace from "./workspace";
export default function StudentApp(){
 const [profile,setProfile]=useState<any>(undefined);
 useEffect(()=>{fetch("/api/auth",{cache:"no-store"}).then(r=>r.json()).then((x:any)=>setProfile(x.user)).catch(()=>setProfile(null))},[]);
 if(profile===undefined)return <div className="dash-loading">Rafeeq</div>;
 if(!profile)return <StudentAuth done={setProfile}/>;
 return <Workspace profile={profile}/>;
}
function StudentAuth({done}:{done:(x:any)=>void}){
  const [mode,setMode]=useState<"register"|"login">("register");
  const [err,setErr]=useState("");
  const [submitting,setSubmitting]=useState(false);

  async function submit(e:any){
    e.preventDefault();
    if(submitting)return;
    setErr("");
    setSubmitting(true);
    try{
      const form=new FormData(e.currentTarget);
      const payload=Object.fromEntries(form);
      const response=await fetch("/api/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...payload,action:mode})});
      const result:any=await response.json().catch(()=>({error:"تعذر الاتصال بالخدمة. حاول مرة أخرى."}));
      if(response.ok&&result.user)done(result.user);
      else setErr(result.error||"تعذر إكمال الطلب. حاول مرة أخرى.");
    }catch{
      setErr("تعذر الاتصال بالخدمة. تحقق من الإنترنت وحاول مرة أخرى.");
    }finally{
      setSubmitting(false);
    }
  }

  function switchMode(){
    setMode(mode==="register"?"login":"register");
    setErr("");
  }

  return <div className="student-auth" dir="rtl"><div className="auth-photo"><Image src="/rafeeq-students-hero.png" alt="طلاب يدرسون" fill priority sizes="50vw"/><div><span>Rafeeq</span><h1>كل يوم منظم<br/>يقربك من هدفك.</h1></div></div><form onSubmit={submit}><div className="brand"><span className="brand-mark">ر</span><span><b>Rafeeq</b><small>رفيق الطالب</small></span></div><span>{mode==="register"?"ابدأ رحلتك مجانًا":"أهلًا بعودتك"}</span><h2>{mode==="register"?"إنشاء حساب طالب":"تسجيل الدخول"}</h2>{mode==="register"&&<><label>الاسم<input name="name" required placeholder="اسمك الكامل"/></label><div className="form-two"><label>الدولة<select name="country"><option value="egypt">مصر</option><option value="jordan">الأردن</option></select></label><label>المسار<select name="track"><option value="science">علمي علوم</option><option value="math">علمي رياضة</option><option value="arts">أدبي</option><option value="tawjihi">توجيهي الأردن</option></select></label></div></>}<label>البريد الإلكتروني<input name="email" type="email" required autoComplete="email" placeholder="name@example.com"/></label><label>كلمة المرور<input name="password" type="password" required minLength={8} autoComplete={mode==="register"?"new-password":"current-password"} placeholder="8 أحرف على الأقل"/></label>{err&&<div className="login-error" role="alert">{err}</div>}<button type="submit" className="btn primary" disabled={submitting}>{submitting?(mode==="register"?"جارٍ إنشاء الحساب...":"جارٍ تسجيل الدخول..."):(mode==="register"?"إنشاء الحساب":"دخول")}{!submitting&&<ChevronLeft/>}</button><p>{mode==="register"?"لديك حساب؟":"ليس لديك حساب؟"}<button type="button" onClick={switchMode}>{mode==="register"?" تسجيل الدخول":" إنشاء حساب"}</button></p></form></div>
}
