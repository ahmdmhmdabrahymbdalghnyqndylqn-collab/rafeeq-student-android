"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { BookOpen, CheckCircle2, FileQuestion, LoaderCircle, Send, Sparkles } from "lucide-react";

type Book = { id: number; title: string; subject: string; pages: number };
type Profile = { name: string; country: string; track: string; language: string };
type Message = { role: "user" | "assistant"; content: string; books?: Book[] };

const englishSubjects: Record<string, string> = {
  "اللغة العربية": "Arabic",
  "اللغة الإنجليزية": "English",
  "الفيزياء": "Physics",
  "الكيمياء": "Chemistry",
  "الأحياء": "Biology",
  "التاريخ": "History",
  "الجغرافيا": "Geography",
  "الرياضيات البحتة": "Pure mathematics",
  "الرياضيات التطبيقية": "Applied mathematics",
};

export default function PrivateTeacher({ ar, profile, catalog }: { ar: boolean; profile: Profile; catalog: Book[] }) {
  const [subject, setSubject] = useState("");
  const [unit, setUnit] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const t = (arabic: string, english: string) => (ar ? arabic : english);
  const subjectOptions = Array.from(new Set(catalog.map((book) => book.subject))).sort((a, b) => a.localeCompare(b, "ar"));

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function askPreset(kind: "explain" | "quiz" | "plan") {
    const selected = subject || t("المادة التي أختارها", "my selected subject");
    const lesson = unit ? ` ${t("في وحدة", "in the unit")} ${unit}` : "";
    const prompts = {
      explain: t(`اشرح لي أهم أفكار ${selected}${lesson} بطريقة بسيطة مع مثال.`, `Explain the key ideas in ${selected}${lesson} simply with an example.`),
      quiz: t(`أنشئ لي اختبارًا قصيرًا في ${selected}${lesson} مع مفتاح الإجابة في النهاية.`, `Create a short quiz for ${selected}${lesson} and include an answer key at the end.`),
      plan: t(`كيف أراجع ${selected}${lesson} اليوم بخطة عملية؟`, `How can I revise ${selected}${lesson} today with a practical plan?`),
    };
    setInput(prompts[kind]);
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const question = input.trim();
    if (!question || pending) return;
    setError("");
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: "user", content: question }]);
    setInput("");
    setPending(true);
    try {
      const response = await fetch("/api/private-teacher", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: question, subject, unit, history }),
      });
      const data = await response.json() as { answer?: string; books?: Book[]; error?: string };
      const answer = data.answer;
      if (!response.ok || !answer) throw new Error(data.error || "Teacher response failed");
      setMessages((current) => [...current, { role: "assistant", content: answer, books: data.books || [] }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("تعذر الاتصال بالمعلم الخاص.", "Could not reach the private teacher."));
    } finally {
      setPending(false);
    }
  }

  const welcome = t(
    `مرحبًا ${profile.name.split(" ")[0]}، أنا المعلم الخاص. اسألني عن درس، اطلب شرحًا أو تدريبًا، أو اختر مادة ووحدة لإنشاء اختبار.`,
    `Welcome ${profile.name.split(" ")[0]}. I am your private teacher. Ask about a lesson, request an explanation or practice, or choose a subject and unit to create a quiz.`,
  );

  return <section className="teacher-page" aria-label={t("المعلم الخاص", "Private teacher")}>
    <header className="teacher-hero">
      <div className="teacher-mark" aria-hidden="true"><Sparkles size={27} strokeWidth={1.8} /></div>
      <div>
        <span>{t("دعم دراسي ذكي", "Smart study support")}</span>
        <h1>{t("المعلم الخاص", "Private teacher")}</h1>
        <p>{t("اشرح، تدرب، وراجع بأسلوب يناسبك.", "Explain, practise, and revise in a way that suits you.")}</p>
      </div>
      <div className="teacher-status"><CheckCircle2 size={16} /> {t("جاهز للمساعدة", "Ready to help")}</div>
    </header>

    <section className="teacher-context" aria-label={t("سياق السؤال", "Question context")}>
      <div><label>{t("المادة", "Subject")}<select value={subject} onChange={(event) => setSubject(event.target.value)}><option value="">{t("اختر المادة (اختياري)", "Choose a subject (optional)")}</option>{subjectOptions.map((item) => <option key={item} value={item}>{ar ? item : englishSubjects[item] || item}</option>)}</select></label></div>
      <div><label>{t("الوحدة أو الدرس", "Unit or lesson")}<input value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={160} placeholder={t("مثال: الفصل الأول", "Example: Unit 1")}/></label></div>
      <div className="teacher-library-count"><BookOpen size={20}/><span><b>{catalog.length}</b> {t("كتابًا في المكتبة", "books in the library")}</span></div>
    </section>

    <section className="teacher-chat-shell">
      <div className="teacher-chat-top"><div><h2>{t("محادثة مع المعلم", "Chat with your teacher")}</h2><p>{t("كل رسالة تظهر بوضوح تحت الرسالة السابقة.", "Each message appears clearly below the previous one.")}</p></div></div>
      <div className="teacher-thread" ref={threadRef} aria-live="polite">
        <article className="teacher-message teacher-message-assistant"><div className="teacher-avatar" aria-hidden="true"><Sparkles size={17}/></div><div><strong>{t("المعلم الخاص", "Private teacher")}</strong><p>{welcome}</p></div></article>
        {messages.map((message, index) => <article key={`${message.role}-${index}`} className={`teacher-message teacher-message-${message.role}`}>
          {message.role === "assistant" && <div className="teacher-avatar" aria-hidden="true"><Sparkles size={17}/></div>}
          <div><strong>{message.role === "user" ? t("أنت", "You") : t("المعلم الخاص", "Private teacher")}</strong><p>{message.content}</p>{message.books && message.books.length > 0 && <div className="teacher-book-links"><span>{t("كتب مرتبطة بالسؤال", "Related library books")}</span>{message.books.map((book) => <small key={book.id}>{book.title}</small>)}</div>}</div>
        </article>)}
        {pending && <article className="teacher-message teacher-message-assistant teacher-thinking"><div className="teacher-avatar" aria-hidden="true"><Sparkles size={17}/></div><div><strong>{t("المعلم الخاص", "Private teacher")}</strong><p><LoaderCircle size={16} className="teacher-spinner"/> {t("يفكّر في إجابة مناسبة…", "Preparing a thoughtful answer…")}</p></div></article>}
      </div>
      <div className="teacher-presets" aria-label={t("اقتراحات", "Suggestions")}><button onClick={() => askPreset("explain")}>{t("اشرح الدرس", "Explain a lesson")}</button><button onClick={() => askPreset("quiz")}><FileQuestion size={15}/>{t("أنشئ اختبارًا", "Create a quiz")}</button><button onClick={() => askPreset("plan")}>{t("خطة مراجعة", "Revision plan")}</button></div>
      {error && <p className="teacher-error" role="alert">{error}</p>}
      <form className="teacher-composer" onSubmit={send}><textarea aria-label={t("رسالتك إلى المعلم الخاص", "Your message to the private teacher")} value={input} onChange={(event) => setInput(event.target.value)} maxLength={1400} rows={2} placeholder={t("اكتب سؤالك، أو اطلب اختبارًا في مادة ووحدة محددة…", "Write your question or request a quiz for a subject and unit…")}/><button className="btn primary" disabled={pending || !input.trim()}>{pending ? <LoaderCircle className="teacher-spinner" size={18}/> : <Send size={18}/>}<span>{t("إرسال", "Send")}</span></button></form>
    </section>
  </section>;
}
