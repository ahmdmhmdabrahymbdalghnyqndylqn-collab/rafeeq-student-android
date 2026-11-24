import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppSurface, palette } from '../../components/AppSurface';
import { type LibraryBook, fetchLibraryCatalog, formatMegabytes } from '../../lib/library';
import { useLocale } from '../../lib/locale';

export default function LibraryScreen() {
  const { direction, locale, t } = useLocale();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('');
  const [selected, setSelected] = useState<LibraryBook | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      setBooks(await fetchLibraryCatalog());
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const subjects = useMemo(() => [...new Set(books.map((book) => book.subject))].sort((first, second) => first.localeCompare(second, 'ar')), [books]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale === 'ar' ? 'ar' : 'en');
    return books.filter((book) => (!subject || book.subject === subject) && (!normalized || `${book.title} ${book.subject}`.toLocaleLowerCase(locale === 'ar' ? 'ar' : 'en').includes(normalized)));
  }, [books, locale, query, subject]);
  const textAlign = direction === 'rtl' ? 'right' : 'left';

  const open = useCallback(async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  }, []);

  return <AppSurface><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.heading}><View><Text style={[styles.eyebrow, { textAlign }]}>{locale === 'ar' ? 'كتبك في مكان واحد' : 'All your books, together'}</Text><Text style={[styles.title, { textAlign }]}>{t('library')}</Text></View><View style={styles.count}><Text style={styles.countValue}>{books.length || '—'}</Text><Text style={styles.countLabel}>{locale === 'ar' ? 'كتابًا' : 'books'}</Text></View></View>
    <Text style={[styles.note, { textAlign }]}>{locale === 'ar' ? 'تُعرض الأغلفة فقط داخل التطبيق. القراءة والتنزيل يبدآن عند اختيار الكتاب، لذلك لا تشغل الكتب مساحة الـAPK.' : 'Only covers are shown in the app. Reading and downloading start when you choose a book, so books never enlarge the APK.'}</Text>
    <TextInput value={query} onChangeText={setQuery} placeholder={locale === 'ar' ? 'ابحث باسم الكتاب أو المادة' : 'Search books or subjects'} placeholderTextColor={palette.muted} style={[styles.search, { textAlign }]} accessibilityLabel={locale === 'ar' ? 'البحث في المكتبة' : 'Search library'} />
    {state === 'loading' && <View style={styles.center}><ActivityIndicator size="large" color={palette.blue} /><Text style={styles.muted}>{locale === 'ar' ? 'جارٍ تجهيز المكتبة…' : 'Loading the library…'}</Text></View>}
    {state === 'error' && <View style={styles.center}><Text style={[styles.error, { textAlign }]}>{locale === 'ar' ? 'تعذر تحميل الكتب. تأكد من اتصال الإنترنت ثم أعد المحاولة.' : 'We could not load the books. Check your connection and retry.'}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>{locale === 'ar' ? 'إعادة المحاولة' : 'Try again'}</Text></Pressable></View>}
    {state === 'ready' && <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={{ direction: direction === 'rtl' ? 'rtl' : 'ltr' }}>
        <FilterChip label={locale === 'ar' ? 'كل المواد' : 'All subjects'} active={!subject} onPress={() => setSubject('')} />
        {subjects.map((name) => <FilterChip key={name} label={name} active={subject === name} onPress={() => setSubject(name)} />)}
      </ScrollView>
      {!filtered.length ? <Text style={[styles.empty, { textAlign }]}>{locale === 'ar' ? 'لا توجد كتب مطابقة لبحثك.' : 'No books match your search.'}</Text> : <View style={styles.grid}>{filtered.map((book) => <Pressable key={book.id} accessibilityRole="button" accessibilityLabel={book.title} onPress={() => setSelected(book)} style={styles.card}><Image source={{ uri: book.coverUrl }} style={styles.cover} resizeMode="contain" /><Text style={[styles.bookTitle, { textAlign }]} numberOfLines={2}>{book.title}</Text><Text style={[styles.subject, { textAlign }]}>{book.subject}</Text></Pressable>)}</View>}
    </>}
    {selected && <View style={styles.sheet}><Pressable accessibilityRole="button" accessibilityLabel={locale === 'ar' ? 'إغلاق تفاصيل الكتاب' : 'Close book details'} onPress={() => setSelected(null)} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable><Image source={{ uri: selected.coverUrl }} style={styles.sheetCover} resizeMode="contain" /><Text style={[styles.sheetSubject, { textAlign }]}>{selected.subject}</Text><Text style={[styles.sheetTitle, { textAlign }]}>{selected.title}</Text><Text style={[styles.sheetInfo, { textAlign }]}>{selected.pages} {locale === 'ar' ? 'صفحة' : 'pages'} · {formatMegabytes(selected.size)}</Text><View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => void open(selected.readUrl)} style={styles.read}><Text style={styles.readText}>{locale === 'ar' ? 'قراءة الكتاب' : 'Read book'}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void open(selected.downloadUrl)} style={styles.download}><Text style={styles.downloadText}>{locale === 'ar' ? 'تنزيل' : 'Download'}</Text></Pressable></View></View>}
  </ScrollView></AppSurface>;
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 16, paddingBottom: 36 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { color: palette.muted, fontSize: 13, marginBottom: 2 }, title: { color: palette.navy, fontSize: 27, fontWeight: '800' }, count: { minWidth: 64, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 16, backgroundColor: palette.ice, alignItems: 'center' }, countValue: { color: palette.blue, fontSize: 20, fontWeight: '800' }, countLabel: { color: palette.muted, fontSize: 11 }, note: { color: palette.ink, lineHeight: 21, backgroundColor: '#F3F8FF', borderRadius: 16, padding: 14 }, search: { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: palette.border, color: palette.ink, paddingHorizontal: 15, fontSize: 16, backgroundColor: palette.white }, filters: { gap: 8, paddingVertical: 2 }, chip: { borderWidth: 1, borderColor: palette.border, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: palette.white }, chipActive: { backgroundColor: palette.blue, borderColor: palette.blue }, chipText: { color: palette.ink, fontSize: 13, fontWeight: '600' }, chipTextActive: { color: palette.white }, center: { alignItems: 'center', gap: 12, paddingVertical: 42, paddingHorizontal: 20 }, muted: { color: palette.muted }, error: { color: '#A34242', lineHeight: 22 }, retry: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: palette.blue }, retryText: { color: palette.white, fontWeight: '700' }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 22 }, card: { width: '47.5%' }, cover: { height: 205, width: '100%', borderRadius: 14, backgroundColor: '#F6F9FE', borderWidth: 1, borderColor: '#E9F0FA' }, bookTitle: { marginTop: 9, color: palette.ink, fontWeight: '700', lineHeight: 20 }, subject: { color: palette.muted, fontSize: 12, marginTop: 3 }, empty: { color: palette.muted, paddingVertical: 34 }, sheet: { borderRadius: 24, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.border, padding: 18, shadowColor: palette.navy, shadowOpacity: 0.12, shadowRadius: 18, elevation: 4 }, close: { position: 'absolute', zIndex: 1, top: 10, left: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: palette.ice, alignItems: 'center', justifyContent: 'center' }, closeText: { color: palette.navy, fontSize: 25, lineHeight: 28 }, sheetCover: { height: 230, width: '100%' }, sheetSubject: { color: palette.blue, fontWeight: '700' }, sheetTitle: { color: palette.ink, fontSize: 20, fontWeight: '800', lineHeight: 28, marginTop: 4 }, sheetInfo: { color: palette.muted, marginTop: 7 }, actions: { flexDirection: 'row', gap: 9, marginTop: 18 }, read: { flex: 1, borderRadius: 14, paddingVertical: 12, backgroundColor: palette.blue, alignItems: 'center' }, readText: { color: palette.white, fontWeight: '800' }, download: { flex: 1, borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: palette.border, alignItems: 'center' }, downloadText: { color: palette.navy, fontWeight: '800' },
});
