import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminSurface, adminPalette } from '../../components/AdminSurface';
import { supabase } from '../../lib/supabase';

type Student = { id: string; display_name: string; country_code: 'EG' | 'JO'; study_track: string; created_at: string };
export default function UsersScreen() {
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true); setError('');
    const { data, error: loadError } = await supabase.from('profiles').select('id, display_name, country_code, study_track, created_at').order('created_at', { ascending: false }).limit(100);
    if (loadError) setError(loadError.message); else setStudents((data ?? []) as Student[]);
    setLoading(false);
  }, []);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); const client = supabase; if (!client) return () => clearTimeout(timer); const channel = client.channel('admin-students').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void load()).subscribe(); return () => { clearTimeout(timer); void client.removeChannel(channel); }; }, [load]);
  const visible = useMemo(() => { const normalized = query.trim().toLocaleLowerCase(); return normalized ? students.filter((student) => `${student.display_name} ${student.country_code} ${student.study_track}`.toLocaleLowerCase().includes(normalized)) : students; }, [query, students]);
  return <AdminSurface><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><Text style={styles.title}>الطلاب</Text><Text style={styles.body}>يعرض آخر 100 ملف طالب مع أقل قدر لازم من البيانات؛ لا تُعرض أرقام الهاتف في لوحة الإدارة.</Text><TextInput accessibilityLabel="بحث عن طالب" value={query} onChangeText={setQuery} style={styles.search} placeholder="ابحث بالاسم أو البلد أو المسار" placeholderTextColor={adminPalette.muted} textAlign="right"/>{loading ? <ActivityIndicator size="large" color={adminPalette.blue}/> : null}{error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()}><Text style={styles.retry}>إعادة المحاولة</Text></Pressable></View> : null}{!loading && !error && visible.length === 0 ? <Text style={styles.empty}>لا توجد نتائج مطابقة.</Text> : null}{visible.map((student) => <View key={student.id} style={styles.item}><View style={styles.avatar}><Text style={styles.avatarText}>{student.display_name.slice(0, 1)}</Text></View><View style={styles.copy}><Text style={styles.name}>{student.display_name}</Text><Text style={styles.meta}>{student.country_code === 'EG' ? 'مصر' : 'الأردن'} · {student.study_track} · {new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(student.created_at))}</Text></View></View>)}</ScrollView></AdminSurface>;
}
const styles = StyleSheet.create({ page: { padding: 20, gap: 13, paddingBottom: 36 }, title: { color: adminPalette.navy, fontSize: 28, fontWeight: '900', textAlign: 'right' }, body: { color: adminPalette.muted, lineHeight: 21, textAlign: 'right' }, search: { minHeight: 49, borderRadius: 14, borderWidth: 1, borderColor: adminPalette.border, backgroundColor: adminPalette.card, color: adminPalette.ink, paddingHorizontal: 13 }, item: { flexDirection: 'row-reverse', alignItems: 'center', gap: 11, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: adminPalette.border, backgroundColor: adminPalette.card }, avatar: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: adminPalette.sky }, avatarText: { color: adminPalette.blue, fontWeight: '900', fontSize: 18 }, copy: { flex: 1, gap: 3 }, name: { color: adminPalette.ink, fontWeight: '900', textAlign: 'right' }, meta: { color: adminPalette.muted, textAlign: 'right', fontSize: 12 }, error: { borderRadius: 14, padding: 14, backgroundColor: '#FFF3F3', gap: 8 }, errorText: { color: adminPalette.danger, textAlign: 'right' }, retry: { color: adminPalette.blue, fontWeight: '900', textAlign: 'right' }, empty: { color: adminPalette.muted, textAlign: 'right', paddingVertical: 26 } });
