import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AdminSurface, adminPalette } from '../components/AdminSurface';
import { supabase } from '../lib/supabase';

export default function AdminSignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const signIn = useCallback(async () => {
    if (!supabase || busy) { setMessage('اربط مفاتيح Supabase العامة أولًا لتسجيل دخول الإدارة.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || password.length < 8) { setMessage('أدخل بريدًا وكلمة مرور صالحين.'); return; }
    setBusy(true); setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) setMessage(error.message); else router.replace('/');
    setBusy(false);
  }, [busy, email, password]);
  return <AdminSurface><KeyboardAvoidingView behavior={Platform.select({ ios: 'padding' })} style={styles.flex}><View style={styles.page}><View style={styles.badge}><Text style={styles.badgeText}>Rafeeq</Text><Text style={styles.badgeSub}>ADMIN</Text></View><Text style={styles.title}>دخول الإدارة</Text><Text style={styles.body}>هذه المساحة لحسابات الإدارة المُضافة فقط. لا يوجد تسجيل عام للمديرين.</Text><Text style={styles.label}>البريد الإلكتروني</Text><TextInput accessibilityLabel="البريد الإلكتروني" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textAlign="left" style={styles.input} placeholder="admin@email.com" placeholderTextColor={adminPalette.muted}/><Text style={styles.label}>كلمة المرور</Text><TextInput accessibilityLabel="كلمة المرور" value={password} onChangeText={setPassword} autoComplete="current-password" secureTextEntry textAlign="left" style={styles.input} placeholder="••••••••" placeholderTextColor={adminPalette.muted}/><Pressable accessibilityRole="button" disabled={busy} onPress={() => void signIn()} style={[styles.primary, busy && styles.disabled]}>{busy ? <ActivityIndicator color={adminPalette.card}/> : <Text style={styles.primaryText}>دخول آمن</Text>}</Pressable>{message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}</View></KeyboardAvoidingView></AdminSurface>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, page: { flex: 1, padding: 24, justifyContent: 'center', gap: 11 }, badge: { alignSelf: 'flex-start', backgroundColor: adminPalette.navy, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12 }, badgeText: { color: adminPalette.card, fontSize: 21, fontWeight: '900' }, badgeSub: { color: '#9CC7FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 }, title: { color: adminPalette.navy, fontSize: 29, fontWeight: '900', textAlign: 'right', marginTop: 9 }, body: { color: adminPalette.muted, lineHeight: 21, textAlign: 'right', marginBottom: 12 }, label: { color: adminPalette.ink, fontWeight: '800', textAlign: 'right' }, input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: adminPalette.border, backgroundColor: adminPalette.card, color: adminPalette.ink, paddingHorizontal: 13, fontSize: 16 }, primary: { minHeight: 52, justifyContent: 'center', alignItems: 'center', borderRadius: 15, backgroundColor: adminPalette.blue, marginTop: 6 }, primaryText: { color: adminPalette.card, fontWeight: '900', fontSize: 16 }, disabled: { opacity: 0.55 }, message: { color: adminPalette.danger, padding: 12, borderRadius: 12, backgroundColor: '#FFF1F1', textAlign: 'right', lineHeight: 20 } });
