import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AdminSurface, adminPalette } from '../components/AdminSurface';
import { useAdminAuth } from '../lib/admin-auth';

export default function AccessDeniedScreen() {
  const { signOut } = useAdminAuth();
  return <AdminSurface><View style={styles.page}><Text style={styles.title}>لا تملك صلاحية الإدارة</Text><Text style={styles.body}>هذا الحساب موجود، لكنه ليس ضمن قائمة مديري رفيق. لن تظهر أي بيانات طلاب أو إعدادات حساسة.</Text><Pressable accessibilityRole="button" onPress={() => void signOut().finally(() => router.replace('/sign-in'))} style={styles.button}><Text style={styles.buttonText}>تسجيل الخروج</Text></Pressable></View></AdminSurface>;
}
const styles = StyleSheet.create({ page: { flex: 1, padding: 25, justifyContent: 'center', gap: 12 }, title: { color: adminPalette.navy, fontSize: 27, fontWeight: '900', textAlign: 'right' }, body: { color: adminPalette.muted, textAlign: 'right', lineHeight: 23 }, button: { marginTop: 8, borderRadius: 14, backgroundColor: adminPalette.blue, paddingVertical: 14, alignItems: 'center' }, buttonText: { color: adminPalette.card, fontWeight: '900' } });
