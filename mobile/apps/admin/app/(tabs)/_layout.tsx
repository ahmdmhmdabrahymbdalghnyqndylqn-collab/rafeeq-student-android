import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { AdminSurface, adminPalette } from '../../components/AdminSurface';
import { useAdminAuth } from '../../lib/admin-auth';

export default function AdminTabsLayout() {
  const { state } = useAdminAuth();
  if (state === 'checking') return <AdminSurface><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={adminPalette.blue}/></View></AdminSurface>;
  if (state === 'unconfigured') return <AdminSurface><View style={{ flex: 1, padding: 28, justifyContent: 'center', gap: 10 }}><Text style={{ color: adminPalette.navy, fontSize: 25, fontWeight: '900', textAlign: 'right' }}>Rafeeq Admin</Text><Text style={{ color: adminPalette.muted, textAlign: 'right', lineHeight: 22 }}>أضف مفاتيح Supabase العامة في بيئة البناء لتفعيل لوحة الإدارة.</Text></View></AdminSurface>;
  if (state === 'unauthenticated') return <Redirect href="/sign-in"/>;
  if (state === 'forbidden') return <Redirect href="/access-denied"/>;
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'نظرة عامة' }} />
      <Tabs.Screen name="users" options={{ title: 'الطلاب' }} />
      <Tabs.Screen name="analytics" options={{ title: 'التحليلات' }} />
      <Tabs.Screen name="moderation" options={{ title: 'المتابعة' }} />
      <Tabs.Screen name="security" options={{ title: 'الأمان' }} />
    </Tabs>
  );
}
