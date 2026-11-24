import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AdminSurface, adminPalette } from '../../components/AdminSurface';
import { useAdminAuth } from '../../lib/admin-auth';
import { getDashboardMetrics, type DashboardMetrics } from '../../lib/admin-data';
import { supabase } from '../../lib/supabase';

export default function OverviewScreen() {
  const { session, signOut } = useAdminAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setError(''); setMetrics(await getDashboardMetrics()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر تحميل المؤشرات.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    const client = supabase;
    if (!client) return () => clearTimeout(timer);
    const channel = client.channel('admin-overview-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'library_events' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competition_rooms' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_events' }, () => void load())
      .subscribe();
    return () => { clearTimeout(timer); void client.removeChannel(channel); };
  }, [load]);
  const leave = async () => { await signOut(); router.replace('/sign-in'); };
  return <AdminSurface><ScrollView contentContainerStyle={styles.page}><View style={styles.header}><View><Text style={styles.brand}>Rafeeq Admin</Text><Text style={styles.caption}>لوحة تشغيل لحظية ومحميّة</Text></View><Pressable accessibilityRole="button" onPress={() => void leave()} style={styles.exit}><Text style={styles.exitText}>خروج</Text></Pressable></View><Text style={styles.email}>{session?.user.email}</Text>{loading ? <View style={styles.center}><ActivityIndicator size="large" color={adminPalette.blue}/></View> : null}{error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => { setLoading(true); void load(); }}><Text style={styles.retry}>إعادة المحاولة</Text></Pressable></View> : null}{metrics ? <><Text style={styles.section}>مؤشرات حية</Text><View style={styles.grid}><Metric icon="◉" label="إجمالي الطلاب" value={metrics.total_students}/><Metric icon="↗" label="مسجّلون خلال 24 ساعة" value={metrics.new_students_last_24h}/><Metric icon="⚔" label="منافسات جارية" value={metrics.active_competitions}/><Metric icon="◷" label="بانتظار منافس" value={metrics.waiting_competitions}/><Metric icon="▣" label="قراءات وتنزيلات اليوم" value={metrics.library_events_last_24h}/><Metric icon="!" label="تنبيهات أمنية مفتوحة" value={metrics.open_security_events} alert={metrics.open_security_events > 0}/></View><Text style={styles.liveNote}>تتحدث البطاقات عند وصول حدث جديد من قاعدة البيانات.</Text></> : null}</ScrollView></AdminSurface>;
}
function Metric({ icon, label, value, alert }: { icon: string; label: string; value: number; alert?: boolean }) { return <View style={[styles.card, alert && styles.alertCard]}><Text style={[styles.icon, alert && styles.alertIcon]}>{icon}</Text><Text style={styles.value}>{value.toLocaleString('ar-EG')}</Text><Text style={styles.label}>{label}</Text></View>; }
const styles = StyleSheet.create({ page: { padding: 20, gap: 15, paddingBottom: 36 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, brand: { color: adminPalette.navy, fontSize: 25, fontWeight: '900' }, caption: { color: adminPalette.muted, marginTop: 2 }, email: { color: adminPalette.muted, textAlign: 'right', fontSize: 12, marginTop: -10 }, exit: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, backgroundColor: '#FFF4F4' }, exitText: { color: adminPalette.danger, fontWeight: '800' }, center: { minHeight: 180, justifyContent: 'center', alignItems: 'center' }, error: { borderRadius: 16, padding: 14, backgroundColor: '#FFF3F3', gap: 8 }, errorText: { color: adminPalette.danger, textAlign: 'right', lineHeight: 20 }, retry: { color: adminPalette.blue, fontWeight: '900', textAlign: 'right' }, section: { color: adminPalette.ink, fontSize: 19, fontWeight: '900', textAlign: 'right' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, card: { width: '48%', flexGrow: 1, borderWidth: 1, borderColor: adminPalette.border, borderRadius: 19, padding: 15, backgroundColor: adminPalette.card, gap: 4 }, alertCard: { borderColor: '#F1BBBB', backgroundColor: '#FFF9F9' }, icon: { color: adminPalette.blue, fontSize: 21, textAlign: 'right' }, alertIcon: { color: adminPalette.danger }, value: { color: adminPalette.navy, fontSize: 25, fontWeight: '900', textAlign: 'right' }, label: { color: adminPalette.muted, fontSize: 12, textAlign: 'right', lineHeight: 17 }, liveNote: { color: adminPalette.muted, textAlign: 'right', lineHeight: 20, fontSize: 12 } });
