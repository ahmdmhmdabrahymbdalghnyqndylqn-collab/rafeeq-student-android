"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Download, Menu } from "lucide-react";

function Logo() {
  return <div className="brand"><span className="brand-mark">R</span><span><b>Rafeeq</b><small>رفيق الطالب</small></span></div>;
}

const features = [
  ["01", "جدولي المرن", "خطة يومية حسب وقتك وموادك، سهلة التعديل وتعيد ترتيب ما فاتك."],
  ["02", "جلسات التركيز", "مؤقت مرن مع تسجيل الإنجاز وربط كل دقيقة بتقدمك الحقيقي."],
  ["03", "مكتبة الكتب", "تصفّح الكتب المتاحة واقرأها أو نزّلها من مكان واحد."],
  ["04", "مساعد رفيق", "ينفّذ أوامر الجدول، يبدأ الجلسة، ويخبرك بما أنجزت."],
  ["05", "متابعة التقدم", "تقارير يومية وأسبوعية وسلسلة إنجاز وتحليل لكل مادة."],
  ["06", "التذكيرات", "تنبيهات قبل الجلسات، ومتابعة تساعدك على الالتزام."],
];

export default function Landing() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(matchMedia("(display-mode: standalone)").matches);
    const handler = (event: Event) => { event.preventDefault(); setInstallPrompt(event); };
    addEventListener("beforeinstallprompt", handler);
    navigator.serviceWorker?.register("/sw.js");
    fetch("/api/metrics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "page_view", page: "landing" }) }).catch(() => {});
    return () => removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (installed) return;
    if (!installPrompt) return alert("من قائمة المتصفح اختر: إضافة إلى الشاشة الرئيسية أو تثبيت التطبيق");
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice?.outcome === "accepted") {
      setInstalled(true);
      fetch("/api/metrics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "install", page: "landing" }) }).catch(() => {});
    }
    setInstallPrompt(null);
  }

  return <main dir="rtl">
    <nav className="topbar wrap"><Logo/><div className="navlinks"><a href="#benefits">المزايا</a><a href="#how">كيف يعمل؟</a><Link href="/app" className="btn ghost">فتح التطبيق</Link><button className="btn primary" onClick={install}>{installed ? <><Check size={18}/> تم التثبيت</> : <><Download size={18}/> تثبيت التطبيق</>}</button></div><Menu className="mobile-menu"/></nav>
    <section className="hero"><div className="wrap hero-grid"><div className="hero-copy"><span className="eyebrow">تنظيم واضح ليومك الدراسي</span><h1>رفيقك اليومي لطريق<br/><em>الثانوية والتوجيهي</em></h1><p>جدول يتكيّف مع يومك، جلسات دراسة مركّزة، مكتبة كتب، ومساعد ينفّذ أوامرك — في مكان واحد.</p><div className="hero-actions"><Link href="/app" className="btn primary big">ابدأ مجانًا <ArrowLeft size={19}/></Link><button onClick={install} className="btn white big"><Download size={19}/> ثبّت Rafeeq</button></div><div className="trust"><span><Check/> مجاني بالكامل الآن</span><span><Check/> مصر والأردن</span><span><Check/> يعمل على كل أجهزتك</span></div></div><div className="hero-art"><Image src="/rafeeq-students-hero.png" alt="طلاب يدرسون مع رفيق" fill priority sizes="(max-width:900px) 100vw,50vw"/></div></div></section>
    <section id="benefits" className="section wrap"><div className="section-head"><span>كل ما يحتاجه الطالب</span><h2>أقل تشتيت، إنجاز أكثر</h2><p>يجعل رفيق الخطوة التالية واضحة، من أول خطة وحتى آخر مراجعة.</p></div><div className="features text-features">{features.map(([number, title, text]) => <article className="feature" key={title}><strong>{number}</strong><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section id="how" className="how"><div className="wrap"><div className="section-head"><span>ثلاث خطوات فقط</span><h2>ابدأ يومك خلال دقائق</h2></div><div className="steps">{[["01","اختر بلدك ومسارك","مصر: علمي علوم، علمي رياضة، أدبي. الأردن: مسار التوجيهي."],["02","أدخل وقتك وموادك","حدد المدرسة والدروس وساعات النوم والمواد التي تحتاج تركيزًا."],["03","ابدأ خطتك","تحصل على جدول واقعي ويمكنك تعديله متى احتجت."]].map(x => <div className="step" key={x[0]}><b>{x[0]}</b><h3>{x[1]}</h3><p>{x[2]}</p></div>)}</div><div className="cta"><div><span>جاهز تبدأ؟</span><h2>خلّي لكل ساعة هدف.</h2><p>رفيق مجاني بالكامل للطلاب في مرحلة الإطلاق.</p></div><Link href="/app" className="btn white big">افتح التطبيق <ArrowLeft/></Link></div></div></section>
    <footer className="wrap footer"><Logo/><p>© 2026 Rafeeq — صُنع للطلاب في مصر والأردن.</p><Link href="/dashboard">لوحة الإدارة</Link></footer>
  </main>;
}
