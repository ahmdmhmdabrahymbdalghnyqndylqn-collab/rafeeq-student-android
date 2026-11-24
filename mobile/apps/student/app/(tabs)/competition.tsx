import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppSurface, palette } from '../../components/AppSurface';
import { useLocale } from '../../lib/locale';
import { supabase } from '../../lib/supabase';

type Subject = { id: string; name_ar: string; name_en: string };
type Room = { id: string; status: 'waiting' | 'active' | 'finished' | 'cancelled'; max_questions: number; started_at: string | null; finished_at: string | null };
type RoomMessage = { id: string; sender_id: string; content: string; created_at: string };

export default function CompetitionScreen() {
  const { direction, locale, t } = useLocale();
  const [state, setState] = useState<'loading' | 'unconfigured' | 'signed-out' | 'ready' | 'error'>('loading');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [scope, setScope] = useState<'subject' | 'all'>('subject');
  const [subjectId, setSubjectId] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState<10 | 15 | 20>(10);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const textAlign = direction === 'rtl' ? 'right' : 'left';
  const roomId = room?.id;

  const load = useCallback(async () => {
    if (!supabase) { setState('unconfigured'); return; }
    setState('loading');
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { setState('signed-out'); return; }
    const { data: profile, error: profileError } = await supabase.from('profiles').select('country_code, study_track').eq('id', sessionData.session.user.id).single();
    if (profileError || !profile) { setFeedback(locale === 'ar' ? 'أكمل بيانات الطالب أولًا قبل دخول المنافسة.' : 'Complete your student profile before joining a competition.'); setState('error'); return; }
    const { data: subjectRows, error: subjectError } = await supabase.from('subjects').select('id, name_ar, name_en').eq('country_code', profile.country_code).eq('study_track', profile.study_track).eq('active', true).order('name_ar');
    if (subjectError) { setFeedback(subjectError.message); setState('error'); return; }
    const available = (subjectRows ?? []) as Subject[];
    setSubjects(available);
    setSubjectId((current) => current || available[0]?.id || '');
    setState('ready');
  }, [locale]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const client = supabase;
    if (!client || !roomId) return;
    let active = true;
    const fetchRoom = async () => {
      const [{ data: nextRoom }, { data: roomMessages }] = await Promise.all([
        client.from('competition_rooms').select('id, status, max_questions, started_at, finished_at').eq('id', roomId).single(),
        client.from('competition_messages').select('id, sender_id, content, created_at').eq('room_id', roomId).order('created_at'),
      ]);
      if (active && nextRoom) setRoom(nextRoom as Room);
      if (active) setMessages((roomMessages ?? []) as RoomMessage[]);
    };
    void fetchRoom();
    const channel = client.channel(`competition:${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'competition_rooms', filter: `id=eq.${roomId}` }, (payload) => { if (active) setRoom(payload.new as Room); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'competition_messages', filter: `room_id=eq.${roomId}` }, (payload) => { if (active) setMessages((current) => [...current, payload.new as RoomMessage]); })
      .subscribe();
    return () => { active = false; void client.removeChannel(channel); };
  }, [roomId]);

  const subjectLabel = useMemo(() => new Map(subjects.map((subject) => [subject.id, locale === 'ar' ? subject.name_ar : subject.name_en])), [locale, subjects]);
  const startMatch = useCallback(async () => {
    if (!supabase || busy || (scope === 'subject' && !subjectId)) return;
    setBusy(true); setFeedback('');
    const { data, error } = await supabase.rpc('join_competition', { requested_scope: scope, requested_subject_id: scope === 'subject' ? subjectId : null, requested_difficulty: difficulty, requested_question_count: questionCount });
    if (error || !data) setFeedback(error?.message ?? (locale === 'ar' ? 'تعذر بدء المنافسة.' : 'We could not start the competition.'));
    else setRoom({ id: data as string, status: 'waiting', max_questions: questionCount, started_at: null, finished_at: null });
    setBusy(false);
  }, [busy, difficulty, locale, questionCount, scope, subjectId]);

  const sendChat = useCallback(async () => {
    const content = chatInput.trim();
    if (!supabase || !room || !content) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from('competition_messages').insert({ room_id: room.id, sender_id: userData.user.id, content });
    if (error) setFeedback(error.message); else setChatInput('');
  }, [chatInput, room]);

  if (state === 'loading') return <AppSurface><View style={styles.center}><ActivityIndicator size="large" color={palette.blue}/></View></AppSurface>;
  if (state === 'unconfigured') return <StatusSurface title={t('competition')} body={locale === 'ar' ? 'المنافسة مؤمّنة وتحتاج ربط مشروع Supabase بالمفاتيح العامة فقط قبل تشغيلها.' : 'Competition is secured and needs the Supabase project connected with public keys before it can run.'}/>;
  if (state === 'signed-out') return <StatusSurface title={t('competition')} body={locale === 'ar' ? 'سجّل دخولك بحساب الطالب للدخول إلى منافسة عادلة وآمنة.' : 'Sign in with your student account to join a fair, secure competition.'}/>;
  if (state === 'error') return <StatusSurface title={t('competition')} body={feedback || (locale === 'ar' ? 'تعذر تجهيز المنافسة.' : 'We could not prepare competition.')} retry={() => void load()}/>;

  return <AppSurface><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><View style={styles.heading}><View><Text style={[styles.eyebrow, { textAlign }]}>{locale === 'ar' ? 'تحدٍّ مباشر وعادل' : 'Live, fair challenge'}</Text><Text style={[styles.title, { textAlign }]}>{t('competition')}</Text></View><View style={styles.live}><Text style={styles.liveDot}>●</Text><Text style={styles.liveText}>{locale === 'ar' ? 'مباشر' : 'Live'}</Text></View></View>{!room ? <><Text style={[styles.intro, { textAlign }]}>{locale === 'ar' ? 'اختر منافسة في مادة محددة أو في جميع المواد. سيطابقك النظام مع طالب من بلدك ومسارك الدراسي وبنفس مستوى الصعوبة.' : 'Choose a subject or all subjects. The system matches you with a student from the same country and study track at the same difficulty.'}</Text><View style={styles.form}><Text style={[styles.label, { textAlign }]}>{locale === 'ar' ? 'نطاق المنافسة' : 'Competition scope'}</Text><View style={styles.choices}><Choice label={locale === 'ar' ? 'مادة واحدة' : 'One subject'} active={scope === 'subject'} onPress={() => setScope('subject')} /><Choice label={locale === 'ar' ? 'جميع المواد' : 'All subjects'} active={scope === 'all'} onPress={() => setScope('all')} /></View>{scope === 'subject' && <><Text style={[styles.label, { textAlign }]}>{locale === 'ar' ? 'المادة' : 'Subject'}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ direction: direction === 'rtl' ? 'rtl' : 'ltr' }} contentContainerStyle={styles.subjects}>{subjects.map((subject) => <Choice key={subject.id} label={subjectLabel.get(subject.id) ?? subject.name_ar} active={subjectId === subject.id} onPress={() => setSubjectId(subject.id)} />)}</ScrollView></>}<Text style={[styles.label, { textAlign }]}>{locale === 'ar' ? 'الصعوبة' : 'Difficulty'}</Text><View style={styles.choices}>{(['easy', 'medium', 'hard'] as const).map((value) => <Choice key={value} label={locale === 'ar' ? ({ easy: 'سهل', medium: 'متوسط', hard: 'قوي' }[value]) : value} active={difficulty === value} onPress={() => setDifficulty(value)} />)}</View><Text style={[styles.label, { textAlign }]}>{locale === 'ar' ? 'عدد الأسئلة' : 'Question count'}</Text><View style={styles.choices}>{([10, 15, 20] as const).map((value) => <Choice key={value} label={`${value}`} active={questionCount === value} onPress={() => setQuestionCount(value)} />)}</View><Pressable accessibilityRole="button" disabled={busy || (scope === 'subject' && !subjectId)} onPress={() => void startMatch()} style={[styles.start, (busy || (scope === 'subject' && !subjectId)) && styles.disabled]}>{busy ? <ActivityIndicator color={palette.white} /> : <Text style={styles.startText}>{locale === 'ar' ? 'ابحث عن منافس' : 'Find an opponent'}</Text>}</Pressable></View></> : <CompetitionRoom room={room} direction={direction} locale={locale} messages={messages} input={chatInput} setInput={setChatInput} onSend={() => void sendChat()} />}{feedback ? <Text accessibilityRole="alert" style={[styles.feedback, { textAlign }]}>{feedback}</Text> : null}</ScrollView></AppSurface>;
}

function CompetitionRoom({ room, direction, locale, messages, input, setInput, onSend }: { room: Room; direction: 'rtl' | 'ltr'; locale: 'ar' | 'en'; messages: RoomMessage[]; input: string; setInput: (value: string) => void; onSend: () => void }) { const textAlign = direction === 'rtl' ? 'right' : 'left'; const status = room.status === 'waiting' ? (locale === 'ar' ? 'جارٍ البحث عن منافس مناسب…' : 'Looking for a suitable opponent…') : room.status === 'active' ? (locale === 'ar' ? 'بدأت المنافسة — تُجهَّز الأسئلة الآن.' : 'Competition started — questions are being prepared.') : room.status === 'finished' ? (locale === 'ar' ? 'انتهت المنافسة. ستظهر النتيجة وملخص الإجابات.' : 'Competition has finished. Results and answer summary are available.') : (locale === 'ar' ? 'ألغيت المنافسة.' : 'Competition cancelled.'); return <View style={styles.room}><View style={styles.roomStatus}><ActivityIndicator color={palette.blue}/><Text style={[styles.roomStatusText, { textAlign }]}>{status}</Text></View><Text style={[styles.roomMeta, { textAlign }]}>{room.max_questions} {locale === 'ar' ? 'أسئلة' : 'questions'}</Text><View style={styles.chat}><Text style={[styles.chatTitle, { textAlign }]}>{locale === 'ar' ? 'محادثة المنافسة' : 'Competition chat'}</Text>{messages.length ? messages.map((message) => <Text key={message.id} style={[styles.message, { textAlign }]}>{message.content}</Text>) : <Text style={[styles.chatEmpty, { textAlign }]}>{locale === 'ar' ? 'يمكنكما التواصل هنا بعد انضمام المنافس.' : 'You can chat here once the opponent joins.'}</Text>}<View style={styles.composer}><TextInput value={input} onChangeText={setInput} placeholder={locale === 'ar' ? 'اكتب رسالة قصيرة' : 'Write a short message'} placeholderTextColor={palette.muted} style={[styles.input, { textAlign }]} maxLength={500}/><Pressable accessibilityRole="button" onPress={onSend} style={styles.send}><Text style={styles.sendText}>↑</Text></Pressable></View></View></View>; }
function StatusSurface({ body, retry, title }: { body: string; retry?: () => void; title: string }) { const { direction, locale } = useLocale(); return <AppSurface><View style={styles.center}><Text style={[styles.title, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{title}</Text><Text style={[styles.statusBody, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{body}</Text>{retry ? <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}><Text style={styles.retryText}>{locale === 'ar' ? 'إعادة المحاولة' : 'Try again'}</Text></Pressable> : null}</View></AppSurface>; }
function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  page: { padding: 20, gap: 16, paddingBottom: 36 }, center: { flex: 1, padding: 28, gap: 13, alignItems: 'center', justifyContent: 'center' }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { color: palette.muted, fontSize: 13 }, title: { color: palette.navy, fontSize: 27, fontWeight: '800' }, live: { flexDirection: 'row', gap: 5, alignItems: 'center', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#EAF9F3' }, liveDot: { color: '#1EA971', fontSize: 10 }, liveText: { color: '#137250', fontWeight: '800', fontSize: 12 }, intro: { color: palette.ink, lineHeight: 22, backgroundColor: '#F3F8FF', borderRadius: 16, padding: 14 }, form: { borderWidth: 1, borderColor: palette.border, borderRadius: 20, padding: 15, gap: 11 }, label: { color: palette.ink, fontWeight: '800' }, choices: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, subjects: { gap: 8 }, choice: { borderWidth: 1, borderColor: palette.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, choiceActive: { backgroundColor: palette.blue, borderColor: palette.blue }, choiceText: { color: palette.ink, fontWeight: '700', fontSize: 13 }, choiceTextActive: { color: palette.white }, start: { backgroundColor: palette.blue, borderRadius: 14, alignItems: 'center', paddingVertical: 14, marginTop: 3 }, startText: { color: palette.white, fontWeight: '800' }, disabled: { opacity: 0.45 }, feedback: { color: '#A34242', backgroundColor: '#FFF3F3', borderRadius: 13, padding: 12, lineHeight: 20 }, room: { gap: 12 }, roomStatus: { flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 18, padding: 16, backgroundColor: palette.ice }, roomStatusText: { color: palette.ink, flex: 1, lineHeight: 21 }, roomMeta: { color: palette.muted }, chat: { borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 14, gap: 10 }, chatTitle: { color: palette.ink, fontWeight: '800', fontSize: 17 }, chatEmpty: { color: palette.muted, lineHeight: 20 }, message: { backgroundColor: '#F7FAFF', color: palette.ink, padding: 10, borderRadius: 12, lineHeight: 20 }, composer: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 }, input: { flex: 1, minHeight: 43, borderRadius: 13, backgroundColor: '#F7FAFF', color: palette.ink, paddingHorizontal: 11 }, send: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.blue }, sendText: { color: palette.white, fontWeight: '800', fontSize: 23 }, statusBody: { color: palette.muted, lineHeight: 22 }, retry: { backgroundColor: palette.blue, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 }, retryText: { color: palette.white, fontWeight: '800' },
});
