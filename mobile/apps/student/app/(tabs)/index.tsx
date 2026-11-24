import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppSurface, palette } from '../../components/AppSurface';
import { useLocale } from '../../lib/locale';
import { loadStudyTasks, type StudyTask } from '../../lib/study-plan';

function taskTime(value: string, locale: 'ar' | 'en'): string { return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value)); }

export default function HomeScreen() {
  const { direction, locale, setLocale, t } = useLocale();
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const textAlign = direction === 'rtl' ? 'right' : 'left';

  const refresh = useCallback(async () => {
    setTasks(await loadStudyTasks().catch(() => []));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const upcoming = useMemo(() => tasks.filter((task) => !task.completed).sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime())[0], [tasks]);
  const completed = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);
  const progress = Math.round((completed / Math.max(tasks.length, 1)) * 100);

  return <AppSurface><ScrollView contentContainerStyle={styles.page} onScrollBeginDrag={() => setMenuOpen(false)}>
    <View style={styles.brand}><Image source={require('../../assets/branding/rafeeq-app-icon.png')} style={styles.logo}/><Text style={styles.wordmark}>Rafeeq</Text><Pressable accessibilityRole="button" accessibilityLabel={locale === 'ar' ? 'القائمة والإعدادات' : 'Menu and settings'} onPress={() => setMenuOpen((open) => !open)} style={styles.menu}><Text style={styles.menuText}>•••</Text></Pressable></View>
    {menuOpen && <View style={styles.menuPanel}><Text style={[styles.menuTitle, { textAlign }]}>{t('settings')}</Text><View style={styles.menuRow}><Text style={styles.menuLabel}>{t('language')}</Text><View style={styles.languageActions}><Pressable accessibilityRole="button" accessibilityState={{ selected: locale === 'ar' }} onPress={() => void setLocale('ar')} style={[styles.language, locale === 'ar' && styles.languageActive]}><Text style={[styles.languageText, locale === 'ar' && styles.languageTextActive]}>العربية</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ selected: locale === 'en' }} onPress={() => void setLocale('en')} style={[styles.language, locale === 'en' && styles.languageActive]}><Text style={[styles.languageText, locale === 'en' && styles.languageTextActive]}>English</Text></Pressable></View></View></View>}
    <View style={styles.hero}><Image source={require('../../assets/branding/study-header.png')} style={styles.heroImage}/><View style={styles.heroOverlay}><Text style={[styles.heroTitle, { textAlign }]}>{t('greeting')}</Text><Text style={[styles.heroSub, { textAlign }]}>{t('welcome')}</Text><Pressable accessibilityRole="button" onPress={() => router.navigate('/planner')} style={styles.primary}><Text style={styles.primaryText}>{t('organize')}</Text></Pressable></View></View>
    <View style={styles.section}><Text style={[styles.sectionTitle, { textAlign }]}>{t('upcoming')}</Text>{upcoming ? <Pressable accessibilityRole="button" onPress={() => router.navigate('/planner')} style={styles.task}><View style={styles.taskCopy}><Text style={[styles.taskTitle, { textAlign }]}>{upcoming.title}</Text><Text style={[styles.taskMeta, { textAlign }]}>{upcoming.subject} · {taskTime(upcoming.startsAt, locale)}</Text></View><Text style={styles.taskIcon}>◷</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => router.navigate('/planner')} style={styles.emptyTask}><Text style={[styles.taskTitle, { textAlign }]}>{t('noTask')}</Text><Text style={[styles.taskMeta, { textAlign }]}>{t('organize')}</Text></Pressable>}</View>
    <View style={styles.section}><View style={styles.progressHeading}><Text style={[styles.sectionTitle, { textAlign }]}>{t('progress')}</Text><Text style={styles.progressValue}>{progress}%</Text></View><View style={styles.progress}><View style={[styles.progressFill, { width: `${progress}%` }]}/></View><Text style={[styles.progressHint, { textAlign }]}>{completed} / {tasks.length} {locale === 'ar' ? 'مهام مكتملة' : 'tasks completed'}</Text></View>
    <View style={styles.shortcuts}><Shortcut label={t('teacher')} icon="✦" onPress={() => router.navigate('/teacher')} /><Shortcut label={t('library')} icon="▣" onPress={() => router.navigate('/library')} /></View>
  </ScrollView></AppSurface>;
}

function Shortcut({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.shortcut}><Text style={styles.shortcutIcon}>{icon}</Text><Text style={styles.shortcutText}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  page: { padding: 20, gap: 20, paddingBottom: 36 }, brand: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 9 }, logo: { width: 36, height: 36, borderRadius: 12 }, wordmark: { fontSize: 23, fontWeight: '800', color: palette.navy, flex: 1 }, menu: { width: 42, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.ice }, menuText: { fontSize: 20, color: palette.navy, letterSpacing: 1, marginTop: -7 }, menuPanel: { borderRadius: 18, padding: 14, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.border, gap: 11 }, menuTitle: { color: palette.ink, fontWeight: '800', fontSize: 16 }, menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, menuLabel: { color: palette.muted, fontWeight: '700' }, languageActions: { flexDirection: 'row', gap: 6 }, language: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: palette.ice }, languageActive: { backgroundColor: palette.blue }, languageText: { color: palette.ink, fontSize: 12, fontWeight: '700' }, languageTextActive: { color: palette.white }, hero: { height: 270, borderRadius: 28, overflow: 'hidden', backgroundColor: palette.ice }, heroImage: { position: 'absolute', width: '100%', height: '100%' }, heroOverlay: { flex: 1, padding: 22, justifyContent: 'flex-end', alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.06)' }, heroTitle: { fontSize: 25, fontWeight: '800', color: palette.navy, width: '70%' }, heroSub: { fontSize: 14, lineHeight: 20, color: palette.ink, width: '68%', marginTop: 6 }, primary: { marginTop: 16, backgroundColor: palette.blue, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 15 }, primaryText: { color: palette.white, fontWeight: '800' }, section: { gap: 10 }, sectionTitle: { fontSize: 20, fontWeight: '800', color: palette.ink }, task: { borderWidth: 1, borderColor: palette.border, borderRadius: 20, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, emptyTask: { borderWidth: 1, borderColor: palette.border, borderRadius: 20, padding: 18 }, taskCopy: { flex: 1 }, taskTitle: { fontSize: 16, fontWeight: '700', color: palette.ink }, taskMeta: { color: palette.muted, marginTop: 4 }, taskIcon: { fontSize: 26, color: palette.blue }, progressHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, progressValue: { color: palette.blue, fontWeight: '800' }, progress: { height: 12, borderRadius: 16, backgroundColor: palette.ice, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: palette.blue, borderRadius: 16 }, progressHint: { color: palette.muted, fontSize: 12 }, shortcuts: { flexDirection: 'row', gap: 10 }, shortcut: { flex: 1, borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 15, alignItems: 'center', gap: 5 }, shortcutIcon: { color: palette.blue, fontSize: 22 }, shortcutText: { color: palette.ink, fontWeight: '800', fontSize: 13 },
});
