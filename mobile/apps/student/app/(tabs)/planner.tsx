import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppSurface, palette } from '../../components/AppSurface';
import { fetchLibraryCatalog } from '../../lib/library';
import { createStudyTask, loadStudyTasks, removeReminder, saveStudyTasks, type StudyTask } from '../../lib/study-plan';
import { useLocale } from '../../lib/locale';

function localDate(): string { return new Date().toLocaleDateString('en-CA'); }
function localTime(): string { const date = new Date(Date.now() + 60 * 60 * 1000); return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }
function parseStart(date: string, time: string): Date | null { if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || !/^\d{2}:\d{2}$/u.test(time)) return null; const value = new Date(`${date}T${time}:00`); return Number.isFinite(value.getTime()) ? value : null; }
function displayTime(value: string, locale: 'ar' | 'en'): string { return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value)); }

export default function PlannerScreen() {
  const { direction, locale, t } = useLocale();
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(localDate);
  const [time, setTime] = useState(localTime);
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const textAlign = direction === 'rtl' ? 'right' : 'left';

  const refresh = useCallback(async () => {
    try { setTasks(await loadStudyTasks()); } catch { setNotice(locale === 'ar' ? 'تعذر قراءة جدولك المحفوظ.' : 'We could not read your saved plan.'); } finally { setLoading(false); }
  }, [locale]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
      void fetchLibraryCatalog().then((books) => setSubjects([...new Set(books.map((book) => book.subject))].sort((first, second) => first.localeCompare(second, 'ar')))).catch(() => undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const upcoming = useMemo(() => tasks.filter((task) => !task.completed).sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()), [tasks]);
  const completed = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);

  const addTask = useCallback(async () => {
    const start = parseStart(date.trim(), time.trim());
    if (!subject) { setNotice(locale === 'ar' ? 'اختر مادة أولًا.' : 'Choose a subject first.'); return; }
    if (!title.trim()) { setNotice(locale === 'ar' ? 'اكتب اسم المهمة أو الدرس.' : 'Enter a task or lesson name.'); return; }
    if (!start || start.getTime() <= Date.now()) { setNotice(locale === 'ar' ? 'اكتب تاريخًا ووقتًا مستقبليين بصيغة صحيحة.' : 'Enter a valid future date and time.'); return; }
    const end = new Date(start.getTime() + duration * 60 * 1000);
    try {
      const studentName = await AsyncStorage.getItem('rafeeq.profile.displayName') ?? undefined;
      const created = await createStudyTask({ subject, title: title.trim(), startsAt: start.toISOString(), endsAt: end.toISOString() }, studentName);
      const next = [...tasks, created].sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime());
      await saveStudyTasks(next);
      setTasks(next);
      setTitle('');
      setNotice(created.reminderId ? (locale === 'ar' ? 'تمت إضافة الجلسة والتنبيه المحلي.' : 'Study session and local reminder added.') : (locale === 'ar' ? 'تمت إضافة الجلسة. فعّل إذن الإشعارات لتصلك التنبيهات.' : 'Session added. Enable notifications to receive reminders.'));
    } catch {
      setNotice(locale === 'ar' ? 'تعذر حفظ الجلسة. حاول مرة أخرى.' : 'We could not save the session. Please try again.');
    }
  }, [date, duration, locale, subject, tasks, time, title]);

  const toggleTask = useCallback(async (task: StudyTask) => {
    const changed = { ...task, completed: !task.completed };
    if (changed.completed) await removeReminder(task);
    const next = tasks.map((current) => current.id === task.id ? changed : current);
    await saveStudyTasks(next);
    setTasks(next);
  }, [tasks]);

  const deleteTask = useCallback(async (task: StudyTask) => {
    await removeReminder(task);
    const next = tasks.filter((current) => current.id !== task.id);
    await saveStudyTasks(next);
    setTasks(next);
  }, [tasks]);

  return <AppSurface><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.heading}><View><Text style={[styles.eyebrow, { textAlign }]}>{locale === 'ar' ? 'خطتك اليومية' : 'Your daily plan'}</Text><Text style={[styles.title, { textAlign }]}>{t('planner')}</Text></View><View style={styles.badge}><Text style={styles.badgeValue}>{upcoming.length}</Text><Text style={styles.badgeLabel}>{locale === 'ar' ? 'قادمة' : 'up next'}</Text></View></View>
    <Text style={[styles.intro, { textAlign }]}>{locale === 'ar' ? 'رتّب جلساتك بنفسك، وسيظهر لك تنبيه محلي عند الموعد. لا يحتاج التطبيق إلى SMS.' : 'Plan your sessions and receive a local reminder at the right time. No SMS is needed.'}</Text>
    <View style={styles.form}><Text style={[styles.label, { textAlign }]}>{locale === 'ar' ? 'المادة' : 'Subject'}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ direction: direction === 'rtl' ? 'rtl' : 'ltr' }} contentContainerStyle={styles.subjects}>{subjects.map((name) => <Chip key={name} label={name} active={subject === name} onPress={() => setSubject(name)} />)}</ScrollView><TextInput value={title} onChangeText={setTitle} placeholder={locale === 'ar' ? 'ماذا ستدرس؟ مثال: قوانين الحركة' : 'What will you study? e.g. Laws of motion'} placeholderTextColor={palette.muted} style={[styles.textInput, { textAlign }]} maxLength={120}/><View style={styles.row}><View style={styles.field}><Text style={[styles.fieldLabel, { textAlign }]}>{locale === 'ar' ? 'التاريخ' : 'Date'}</Text><TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={palette.muted} style={[styles.textInput, { textAlign: 'center' }]} keyboardType="numbers-and-punctuation"/></View><View style={styles.field}><Text style={[styles.fieldLabel, { textAlign }]}>{locale === 'ar' ? 'الوقت' : 'Time'}</Text><TextInput value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor={palette.muted} style={[styles.textInput, { textAlign: 'center' }]} keyboardType="numbers-and-punctuation"/></View></View><Text style={[styles.fieldLabel, { textAlign }]}>{locale === 'ar' ? 'مدة الجلسة' : 'Session duration'}</Text><View style={styles.durations}>{[45, 60, 90].map((minutes) => <Chip key={minutes} label={`${minutes} ${locale === 'ar' ? 'دقيقة' : 'min'}`} active={duration === minutes} onPress={() => setDuration(minutes)} />)}</View><Pressable accessibilityRole="button" onPress={() => void addTask()} style={styles.add}><Text style={styles.addText}>{locale === 'ar' ? 'إضافة إلى جدولي' : 'Add to my plan'}</Text></Pressable></View>
    {notice ? <Text accessibilityRole="alert" style={[styles.notice, { textAlign }]}>{notice}</Text> : null}
    <View style={styles.summary}><View style={styles.summaryItem}><Text style={styles.summaryValue}>{upcoming.length}</Text><Text style={styles.summaryLabel}>{locale === 'ar' ? 'جلسات قادمة' : 'Upcoming'}</Text></View><View style={styles.summaryItem}><Text style={styles.summaryValue}>{completed}</Text><Text style={styles.summaryLabel}>{locale === 'ar' ? 'مهام مكتملة' : 'Completed'}</Text></View><View style={styles.summaryItem}><Text style={styles.summaryValue}>{Math.round((completed / Math.max(tasks.length, 1)) * 100)}%</Text><Text style={styles.summaryLabel}>{locale === 'ar' ? 'إنجاز' : 'Progress'}</Text></View></View>
    <View style={styles.listHeader}><Text style={[styles.listTitle, { textAlign }]}>{locale === 'ar' ? 'جلساتي' : 'My sessions'}</Text><Text style={styles.listCount}>{tasks.length}</Text></View>
    {loading ? <View style={styles.loading}><ActivityIndicator color={palette.blue}/></View> : !tasks.length ? <Text style={[styles.empty, { textAlign }]}>{locale === 'ar' ? 'لم تضف جلسة بعد. ابدأ بمادة وموعد يناسبك.' : 'No sessions yet. Start with a subject and a time that suits you.'}</Text> : tasks.map((task) => <View key={task.id} style={[styles.task, task.completed && styles.taskDone]}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.completed }} onPress={() => void toggleTask(task)} style={[styles.check, task.completed && styles.checkDone]}><Text style={styles.checkText}>{task.completed ? '✓' : ''}</Text></Pressable><View style={styles.taskCopy}><Text style={[styles.taskTitle, { textAlign }]}>{task.title}</Text><Text style={[styles.taskMeta, { textAlign }]}>{task.subject} · {displayTime(task.startsAt, locale)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={locale === 'ar' ? 'حذف الجلسة' : 'Delete session'} onPress={() => void deleteTask(task)} style={styles.delete}><Text style={styles.deleteText}>×</Text></Pressable></View>)}
  </ScrollView></AppSurface>;
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  page: { padding: 20, gap: 15, paddingBottom: 36 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { color: palette.muted, fontSize: 13 }, title: { color: palette.navy, fontSize: 27, fontWeight: '800', marginTop: 2 }, badge: { borderRadius: 16, backgroundColor: palette.ice, paddingHorizontal: 11, paddingVertical: 8, alignItems: 'center' }, badgeValue: { color: palette.blue, fontSize: 19, fontWeight: '800' }, badgeLabel: { color: palette.muted, fontSize: 10 }, intro: { borderRadius: 15, backgroundColor: '#F3F8FF', padding: 13, color: palette.ink, lineHeight: 21 }, form: { gap: 10, borderRadius: 20, borderWidth: 1, borderColor: palette.border, padding: 15 }, label: { color: palette.ink, fontWeight: '800' }, subjects: { gap: 7 }, chip: { borderRadius: 999, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 11, paddingVertical: 8 }, chipActive: { backgroundColor: palette.blue, borderColor: palette.blue }, chipText: { color: palette.ink, fontSize: 12, fontWeight: '700' }, chipTextActive: { color: palette.white }, textInput: { minHeight: 46, borderRadius: 13, backgroundColor: '#F7FAFF', color: palette.ink, paddingHorizontal: 12, fontSize: 15 }, row: { flexDirection: 'row', gap: 10 }, field: { flex: 1, gap: 5 }, fieldLabel: { color: palette.muted, fontSize: 12, fontWeight: '700' }, durations: { flexDirection: 'row', gap: 7 }, add: { alignItems: 'center', borderRadius: 14, backgroundColor: palette.blue, paddingVertical: 13, marginTop: 3 }, addText: { color: palette.white, fontWeight: '800' }, notice: { borderRadius: 13, backgroundColor: '#FFF8DF', color: '#735B00', padding: 12, lineHeight: 20 }, summary: { flexDirection: 'row', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: palette.border }, summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 13 }, summaryValue: { color: palette.navy, fontWeight: '800', fontSize: 22, textAlign: 'center' }, summaryLabel: { color: palette.muted, fontSize: 11, marginTop: 2, textAlign: 'center' }, listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }, listTitle: { color: palette.ink, fontSize: 20, fontWeight: '800' }, listCount: { color: palette.blue, fontWeight: '800' }, loading: { alignItems: 'center', paddingVertical: 28 }, empty: { color: palette.muted, paddingVertical: 30, lineHeight: 22 }, task: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 13 }, taskDone: { opacity: 0.56 }, check: { width: 26, height: 26, borderRadius: 9, borderWidth: 1, borderColor: '#A9BCD9', alignItems: 'center', justifyContent: 'center' }, checkDone: { backgroundColor: '#1EA971', borderColor: '#1EA971' }, checkText: { color: palette.white, fontWeight: '900' }, taskCopy: { flex: 1 }, taskTitle: { color: palette.ink, fontWeight: '800', fontSize: 15 }, taskMeta: { color: palette.muted, marginTop: 3, fontSize: 12 }, delete: { width: 29, height: 29, borderRadius: 15, backgroundColor: '#FFF1F1', alignItems: 'center', justifyContent: 'center' }, deleteText: { color: '#B14D4D', fontSize: 23, lineHeight: 26 },
});
