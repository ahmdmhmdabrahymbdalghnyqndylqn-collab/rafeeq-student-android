import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppSurface, palette } from '../../components/AppSurface';
import { fetchLibraryCatalog } from '../../lib/library';
import { useLocale } from '../../lib/locale';

const TEACHER_API_URL = process.env.EXPO_PUBLIC_TEACHER_API_URL ?? 'https://rafeeq-private-teacher.ahmdmhmdabrahymbdalghnyqndylqn.workers.dev';
const REQUEST_TIMEOUT_MS = 45_000;

type Source = { title: string; subject: string; page: number };
type ChatMessage = { id: string; role: 'student' | 'assistant'; content: string; sources?: Source[] };
type ApiMessage = { role: 'user' | 'assistant'; content: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function TeacherScreen() {
  const { direction, locale, t } = useLocale();
  const [subject, setSubject] = useState('');
  const [unit, setUnit] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const threadRef = useRef<ScrollViewInstance>(null);
  const textAlign = direction === 'rtl' ? 'right' : 'left';

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLibraryCatalog().then((books) => {
        setSubjects([...new Set(books.map((book) => book.subject))].sort((first, second) => first.localeCompare(second, 'ar')));
      }).catch(() => {
        // A question can still be sent without a selected subject.
      });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const history = useMemo<ApiMessage[]>(() => messages.slice(-4).map((message) => ({ role: message.role === 'student' ? 'user' : 'assistant', content: message.content })), [messages]);

  const send = useCallback(async (preset?: string) => {
    const question = (preset ?? input).trim();
    if (!question || thinking) return;

    const studentMessage: ChatMessage = { id: makeId(), role: 'student', content: question };
    setMessages((current) => [...current, studentMessage]);
    setInput('');
    setError('');
    setThinking(true);
    requestAnimationFrame(() => threadRef.current?.scrollToEnd({ animated: true }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${TEACHER_API_URL}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: question, subject, unit: unit.trim(), history }),
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => ({}));
      const answer = body && typeof body === 'object' && typeof (body as { answer?: unknown }).answer === 'string' ? (body as { answer: string }).answer.trim() : '';
      const apiError = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : '';
      if (!response.ok || !answer) throw new Error(apiError || 'Teacher response is unavailable.');
      const rawSources = body && typeof body === 'object' && Array.isArray((body as { sources?: unknown }).sources) ? (body as { sources: unknown[] }).sources : [];
      const sources: Source[] = rawSources.flatMap((value) => value && typeof value === 'object' && typeof (value as Source).title === 'string' && typeof (value as Source).subject === 'string' && typeof (value as Source).page === 'number' ? [{ title: (value as Source).title, subject: (value as Source).subject, page: (value as Source).page }] : []);
      setMessages((current) => [...current, { id: makeId(), role: 'assistant', content: answer, sources }]);
    } catch (requestError) {
      setError(requestError instanceof Error && requestError.name === 'AbortError' ? (locale === 'ar' ? 'استغرق الرد وقتًا أطول من المعتاد. حاول مجددًا.' : 'The response took longer than usual. Please try again.') : (requestError instanceof Error && requestError.message ? requestError.message : (locale === 'ar' ? 'تعذر الاتصال بالمعلم الآن. تأكد من اتصال الإنترنت وحاول ثانية.' : 'We could not reach the teacher. Check your connection and retry.')));
    } finally {
      clearTimeout(timeout);
      setThinking(false);
      requestAnimationFrame(() => threadRef.current?.scrollToEnd({ animated: true }));
    }
  }, [history, input, locale, subject, thinking, unit]);

  const exportAnswer = useCallback(async () => {
    const answer = [...messages].reverse().find((message) => message.role === 'assistant');
    if (!answer) return;
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      setError(locale === 'ar' ? 'لا يدعم هذا الجهاز مشاركة ملف PDF.' : 'This device cannot share PDF files.');
      return;
    }
    const sourceLines = answer.sources?.map((source) => `• ${escapeHtml(source.title)} — ${locale === 'ar' ? 'صفحة' : 'page'} ${source.page}`).join('<br/>') ?? '';
    const html = `<!doctype html><html dir="${direction}" lang="${locale}"><meta charset="utf-8"/><style>body{font-family:Arial,sans-serif;color:#102A56;line-height:1.8;padding:28px}h1{color:#0D6FEA;font-size:24px}article{white-space:pre-wrap;font-size:16px}.sources{border-top:1px solid #DCEBFC;margin-top:24px;padding-top:14px;color:#63769B}</style><h1>Rafeeq — ${locale === 'ar' ? 'المعلم الخاص' : 'Private Teacher'}</h1><article>${escapeHtml(answer.content)}</article>${sourceLines ? `<section class="sources"><strong>${locale === 'ar' ? 'المراجع من المكتبة' : 'Library references'}</strong><br/>${sourceLines}</section>` : ''}</html>`;
    try {
      const file = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: locale === 'ar' ? 'حفظ أو مشاركة إجابة المعلم' : 'Save or share teacher answer', UTI: 'com.adobe.pdf' });
    } catch {
      setError(locale === 'ar' ? 'تعذر إنشاء ملف PDF. حاول مرة أخرى.' : 'We could not create the PDF. Please try again.');
    }
  }, [direction, locale, messages]);

  return <AppSurface><KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', default: undefined })}><View style={styles.page}>
    <View style={styles.head}><Image source={require('../../assets/branding/private-teacher-icon.png')} style={styles.icon}/><View style={styles.headCopy}><Text style={[styles.title, { textAlign }]}>{t('teacher')}</Text><Text style={[styles.hint, { textAlign }]}>{t('teacherHint')}</Text></View><View style={styles.status}><Text style={styles.statusDot}>●</Text><Text style={styles.statusText}>{locale === 'ar' ? 'جاهز' : 'Ready'}</Text></View></View>
    <View style={styles.context}><Text style={[styles.contextLabel, { textAlign }]}>{locale === 'ar' ? 'المادة' : 'Subject'}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ direction: direction === 'rtl' ? 'rtl' : 'ltr' }} contentContainerStyle={styles.subjects}><SubjectChip label={locale === 'ar' ? 'أي مادة' : 'Any subject'} active={!subject} onPress={() => setSubject('')} />{subjects.map((name) => <SubjectChip key={name} label={name} active={subject === name} onPress={() => setSubject(name)} />)}</ScrollView><TextInput accessibilityLabel={locale === 'ar' ? 'الوحدة أو الدرس' : 'Unit or lesson'} value={unit} onChangeText={setUnit} placeholder={locale === 'ar' ? 'الوحدة أو الدرس (اختياري)' : 'Unit or lesson (optional)'} placeholderTextColor={palette.muted} style={[styles.unit, { textAlign }]} /></View>
    <View style={styles.chat}><View style={styles.chatTop}><View><Text style={[styles.chatTitle, { textAlign }]}>{locale === 'ar' ? 'محادثة مع المعلم' : 'Chat with your teacher'}</Text><Text style={[styles.chatHint, { textAlign }]}>{locale === 'ar' ? 'إجابات منظمة ومراجع ظاهرة عند استخدام كتب المكتبة.' : 'Organized answers with visible library references when used.'}</Text></View><Pressable accessibilityRole="button" disabled={!messages.some((message) => message.role === 'assistant')} onPress={() => void exportAnswer()} style={[styles.pdf, !messages.some((message) => message.role === 'assistant') && styles.disabled]}><Text style={styles.pdfText}>PDF</Text></Pressable></View>
      <ScrollView ref={threadRef} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled"><TeacherIntro locale={locale} direction={direction}/>{messages.map((message) => <MessageBubble key={message.id} message={message} direction={direction} locale={locale}/>) }{thinking && <View style={styles.thinking}><Image source={require('../../assets/branding/private-teacher-icon.png')} style={styles.thinkingIcon}/><ActivityIndicator color={palette.blue}/><Text style={[styles.thinkingText, { textAlign }]}>{locale === 'ar' ? 'المعلم يراجع سؤالك ويجهز الإجابة…' : 'Your teacher is reviewing the question…'}</Text></View>}{error ? <Text accessibilityRole="alert" style={[styles.error, { textAlign }]}>{error}</Text> : null}</ScrollView>
      <View style={styles.quick}><QuickButton label={locale === 'ar' ? 'اشرح الدرس' : 'Explain a lesson'} onPress={() => void send(locale === 'ar' ? 'اشرح لي الدرس ببساطة مع مثال.' : 'Explain this lesson simply with an example.')} /><QuickButton label={locale === 'ar' ? 'أنشئ اختبارًا' : 'Create a quiz'} onPress={() => void send(locale === 'ar' ? 'أنشئ لي اختبارًا قصيرًا مع الإجابات.' : 'Create a short quiz with answers.')} /><QuickButton label={locale === 'ar' ? 'خطة مراجعة' : 'Revision plan'} onPress={() => void send(locale === 'ar' ? 'اعمل لي خطة مراجعة اليوم.' : 'Create a revision plan for today.')} /></View>
      <View style={styles.composer}><TextInput accessibilityLabel={t('teacher')} value={input} onChangeText={setInput} placeholder={t('askTeacher')} placeholderTextColor={palette.muted} editable={!thinking} style={[styles.input, { textAlign }]} multiline maxLength={1100}/><Pressable accessibilityRole="button" accessibilityLabel={locale === 'ar' ? 'إرسال السؤال' : 'Send question'} disabled={!input.trim() || thinking} onPress={() => void send()} style={[styles.send, (!input.trim() || thinking) && styles.disabled]}>{thinking ? <ActivityIndicator color={palette.white} /> : <Text style={styles.sendText}>↑</Text>}</Pressable></View>
    </View>
  </View></KeyboardAvoidingView></AppSurface>;
}

function SubjectChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.subjectChip, active && styles.subjectChipActive]}><Text style={[styles.subjectText, active && styles.subjectTextActive]}>{label}</Text></Pressable>; }
function QuickButton({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.quickButton}><Text style={styles.quickText}>{label}</Text></Pressable>; }
function TeacherIntro({ direction, locale }: { direction: 'rtl' | 'ltr'; locale: 'ar' | 'en' }) { return <View style={styles.assistantMessage}><Image source={require('../../assets/branding/private-teacher-icon.png')} style={styles.avatar}/><View style={styles.assistantBubble}><Text style={[styles.messageName, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{locale === 'ar' ? 'المعلم الخاص' : 'Private Teacher'}</Text><Text style={[styles.messageText, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{locale === 'ar' ? 'أهلًا بك! اسأل عن درس، اطلب شرحًا أو اختبارًا، وحدد المادة إن أردت.' : 'Welcome! Ask about a lesson, request an explanation or a quiz, and select a subject if you want.'}</Text></View></View>; }
function MessageBubble({ direction, locale, message }: { direction: 'rtl' | 'ltr'; locale: 'ar' | 'en'; message: ChatMessage }) { const student = message.role === 'student'; const align = direction === 'rtl' ? 'right' : 'left'; return <View style={[student ? styles.studentMessage : styles.assistantMessage, student && styles.studentMessageReverse]}>{!student ? <Image source={require('../../assets/branding/private-teacher-icon.png')} style={styles.avatar}/> : null}<View style={[student ? styles.studentBubble : styles.assistantBubble]}><Text style={[styles.messageName, student && styles.studentName, { textAlign: align }]}>{student ? (locale === 'ar' ? 'أنت' : 'You') : (locale === 'ar' ? 'المعلم الخاص' : 'Private Teacher')}</Text><Text style={[styles.messageText, student && styles.studentText, { textAlign: align }]}>{message.content}</Text>{!student && message.sources?.length ? <View style={styles.sources}><Text style={[styles.sourceHeading, { textAlign: align }]}>{locale === 'ar' ? 'من المكتبة' : 'From the library'}</Text>{message.sources.slice(0, 3).map((source) => <Text key={`${source.title}-${source.page}`} style={[styles.source, { textAlign: align }]}>{source.title} — {locale === 'ar' ? 'ص' : 'p.'} {source.page}</Text>)}</View> : null}</View></View>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, page: { flex: 1, padding: 16, gap: 12 }, head: { flexDirection: 'row', gap: 11, alignItems: 'center' }, icon: { width: 56, height: 56 }, headCopy: { flex: 1 }, title: { color: palette.navy, fontSize: 22, fontWeight: '800' }, hint: { color: palette.muted, marginTop: 3, fontSize: 13, lineHeight: 18 }, status: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 99, backgroundColor: '#EAF9F3', paddingHorizontal: 9, paddingVertical: 6 }, statusDot: { color: '#1EA971', fontSize: 10 }, statusText: { color: '#137250', fontWeight: '700', fontSize: 12 }, context: { borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 12, gap: 9 }, contextLabel: { color: palette.ink, fontWeight: '800' }, subjects: { gap: 7 }, subjectChip: { borderRadius: 999, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 11, paddingVertical: 7 }, subjectChipActive: { backgroundColor: palette.blue, borderColor: palette.blue }, subjectText: { color: palette.ink, fontSize: 12, fontWeight: '700' }, subjectTextActive: { color: palette.white }, unit: { minHeight: 42, borderRadius: 12, backgroundColor: '#F7FAFF', color: palette.ink, paddingHorizontal: 12 }, chat: { flex: 1, minHeight: 0, borderWidth: 1, borderColor: palette.border, borderRadius: 20, overflow: 'hidden', backgroundColor: palette.white }, chatTop: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: palette.border }, chatTitle: { color: palette.ink, fontWeight: '800', fontSize: 17 }, chatHint: { color: palette.muted, marginTop: 3, maxWidth: 260, fontSize: 12, lineHeight: 17 }, pdf: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: palette.border }, pdfText: { color: palette.blue, fontWeight: '800', fontSize: 12 }, thread: { padding: 14, gap: 14 }, assistantMessage: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', maxWidth: '94%' }, studentMessage: { alignSelf: 'flex-end', maxWidth: '84%' }, studentMessageReverse: { flexDirection: 'row-reverse' }, avatar: { width: 31, height: 31, borderRadius: 10 }, assistantBubble: { flex: 1, borderWidth: 1, borderColor: palette.border, borderRadius: 14, borderTopLeftRadius: 4, padding: 11, backgroundColor: palette.white }, studentBubble: { borderRadius: 14, borderTopRightRadius: 4, padding: 11, backgroundColor: palette.navy }, messageName: { color: palette.blue, fontSize: 12, fontWeight: '800', marginBottom: 4 }, studentName: { color: '#DCEBFC' }, messageText: { color: palette.ink, fontSize: 15, lineHeight: 23 }, studentText: { color: palette.white }, sources: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: palette.border, gap: 3 }, sourceHeading: { color: palette.muted, fontSize: 11, fontWeight: '800' }, source: { color: palette.blue, fontSize: 11, lineHeight: 16 }, thinking: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 14, padding: 11, backgroundColor: palette.ice }, thinkingIcon: { width: 25, height: 25, borderRadius: 8 }, thinkingText: { flex: 1, color: palette.ink, fontSize: 13, lineHeight: 18 }, error: { color: '#A34242', backgroundColor: '#FFF3F3', borderRadius: 12, padding: 10, lineHeight: 20 }, quick: { flexDirection: 'row', gap: 7, paddingHorizontal: 13, paddingTop: 12 }, quickButton: { flex: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 9, backgroundColor: palette.ice, alignItems: 'center' }, quickText: { color: palette.navy, fontSize: 11, fontWeight: '800' }, composer: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: palette.border, padding: 12 }, input: { flex: 1, minHeight: 43, maxHeight: 100, color: palette.ink, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#F7FAFF', borderRadius: 14, fontSize: 15 }, send: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' }, sendText: { color: palette.white, fontWeight: '900', fontSize: 24 }, disabled: { opacity: 0.45 },
});
