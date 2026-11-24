import { useCallback, useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { AppSurface, palette } from '../components/AppSurface';
import { useLocale } from '../lib/locale';
import { normalizeStudentPhone, type SupportedCountry } from '../lib/profile-input';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

type Country = SupportedCountry;
type Track = 'scientific' | 'literary' | 'math';
type Mode = 'sign-in' | 'sign-up';

const countryCopy: Record<Country, { ar: string; en: string }> = { EG: { ar: 'مصر', en: 'Egypt' }, JO: { ar: 'الأردن', en: 'Jordan' } };
const trackCopy: Record<Track, { ar: string; en: string }> = { scientific: { ar: 'علمي', en: 'Scientific' }, literary: { ar: 'أدبي', en: 'Literary' }, math: { ar: 'رياضي', en: 'Mathematics' } };

function parseOAuthParams(url: string): Record<string, string> {
  const [beforeHash, fragment = ''] = url.split('#', 2);
  const query = beforeHash.split('?', 2)[1] ?? '';
  return Object.fromEntries(new URLSearchParams(`${query}&${fragment}`));
}

export default function SignInScreen() {
  const { direction, locale } = useLocale();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<Country>('EG');
  const [track, setTrack] = useState<Track>('scientific');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const textAlign = direction === 'rtl' ? 'right' : 'left';
  const copy = useMemo(() => locale === 'ar' ? {
    signIn: 'تسجيل الدخول', signUp: 'إنشاء حساب الطالب', email: 'البريد الإلكتروني', password: 'كلمة المرور', name: 'اسم الطالب', phone: 'رقم الهاتف', country: 'البلد', track: 'المسار الدراسي', continue: 'متابعة', google: 'المتابعة بواسطة Google', account: 'ليس لديك حساب؟', haveAccount: 'لديك حساب بالفعل؟', create: 'أنشئ حسابًا', login: 'سجّل الدخول', emailHint: 'example@email.com', phoneHint: country === 'EG' ? '01XXXXXXXXX' : '07XXXXXXXX', unavailable: 'تسجيل الحساب يحتاج ربط Supabase بالمفاتيح العامة أولًا.', verifyEmail: 'تم إنشاء الحساب. افتح بريدك الإلكتروني لتأكيده ثم سجّل الدخول.', cancelled: 'أُلغيت عملية تسجيل الدخول.', invalid: 'تحقق من الاسم والبريد وكلمة المرور ورقم الهاتف.', googleConfig: 'لا يمكن إتمام Google الآن. تأكد من تفعيل Google وRedirect URL داخل Supabase.', failure: 'تعذر إتمام العملية. تحقق من البيانات وحاول مجددًا.', privacy: 'رقمك محفوظ بشكل آمن لاسترداد الحساب فقط، ولا نرسل رسائل SMS.'
  } : {
    signIn: 'Sign in', signUp: 'Create student account', email: 'Email address', password: 'Password', name: 'Student name', phone: 'Phone number', country: 'Country', track: 'Study track', continue: 'Continue', google: 'Continue with Google', account: 'New to Rafeeq?', haveAccount: 'Already have an account?', create: 'Create an account', login: 'Sign in', emailHint: 'example@email.com', phoneHint: country === 'EG' ? '01XXXXXXXXX' : '07XXXXXXXX', unavailable: 'Account sign-in needs the Supabase project connected with public keys first.', verifyEmail: 'Account created. Check your email to confirm it, then sign in.', cancelled: 'Sign-in was cancelled.', invalid: 'Check your name, email, password, and phone number.', googleConfig: 'Google sign-in is not ready. Enable Google and add the redirect URL in Supabase.', failure: 'We could not complete that request. Check your details and try again.', privacy: 'Your phone is stored securely for account recovery only; Rafeeq does not send SMS.'
  }, [country, locale]);

  const submitEmail = useCallback(async () => {
    const client = supabase;
    if (!client || busy) { setMessage(copy.unavailable); return; }
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail) || password.length < 8 || (mode === 'sign-up' && (name.trim().length < 2 || !normalizeStudentPhone(country, phone)))) { setMessage(copy.invalid); return; }
    setBusy(true); setMessage('');
    try {
      if (mode === 'sign-in') {
        const { error } = await client.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
        router.replace('/');
      } else {
        const phoneE164 = normalizeStudentPhone(country, phone);
        const { data, error } = await client.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { display_name: name.trim(), country_code: country, study_track: track, phone_e164: phoneE164, preferred_locale: locale } },
        });
        if (error) throw error;
        if (data.session) router.replace('/');
        else { setMode('sign-in'); setMessage(copy.verifyEmail); }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.failure);
    } finally { setBusy(false); }
  }, [busy, copy, country, email, locale, mode, name, password, phone, track]);

  const signInWithGoogle = useCallback(async () => {
    const client = supabase;
    if (!client || busy) { setMessage(copy.unavailable); return; }
    setBusy(true); setMessage('');
    try {
      const redirectTo = makeRedirectUri({ scheme: 'rafeeq', path: 'auth/callback' });
      const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } });
      if (error || !data.url) throw error ?? new Error(copy.googleConfig);
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') { setMessage(copy.cancelled); return; }
      const params = parseOAuthParams(result.url);
      if (params.error) throw new Error(params.error_description ?? params.error);
      if (params.code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(params.code);
        if (exchangeError) throw exchangeError;
      } else if (params.access_token && params.refresh_token) {
        const { error: sessionError } = await client.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
        if (sessionError) throw sessionError;
      } else throw new Error(copy.googleConfig);
      router.replace('/');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.googleConfig);
    } finally { setBusy(false); }
  }, [busy, copy]);

  return <AppSurface><KeyboardAvoidingView behavior={Platform.select({ ios: 'padding' })} style={styles.flex}><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><View style={styles.brand}><Image source={require('../assets/branding/rafeeq-app-icon.png')} style={styles.logo}/><Text style={styles.wordmark}>Rafeeq</Text></View><View style={styles.heading}><Text style={[styles.title, { textAlign }]}>{mode === 'sign-in' ? copy.signIn : copy.signUp}</Text><Text style={[styles.subtitle, { textAlign }]}>{locale === 'ar' ? 'حساب واحد يحفظ خطتك وتقدمك على أي هاتف.' : 'One account keeps your plan and progress on every phone.'}</Text></View>{mode === 'sign-up' ? <><Field label={copy.name} value={name} onChangeText={setName} textAlign={textAlign} autoComplete="name"/><Text style={[styles.label, { textAlign }]}>{copy.country}</Text><View style={styles.choiceRow}>{(['EG', 'JO'] as const).map((value) => <Choice key={value} active={country === value} label={countryCopy[value][locale]} onPress={() => setCountry(value)}/>)}</View><Text style={[styles.label, { textAlign }]}>{copy.track}</Text><View style={styles.choiceRow}>{(['scientific', 'literary', 'math'] as const).map((value) => <Choice key={value} active={track === value} label={trackCopy[value][locale]} onPress={() => setTrack(value)}/>)}</View><Field label={copy.phone} value={phone} onChangeText={setPhone} textAlign="left" autoComplete="tel" keyboardType="phone-pad" placeholder={copy.phoneHint}/><Text style={[styles.privacy, { textAlign }]}>{copy.privacy}</Text></> : null}<Field label={copy.email} value={email} onChangeText={setEmail} textAlign="left" autoComplete="email" keyboardType="email-address" autoCapitalize="none" placeholder={copy.emailHint}/><Field label={copy.password} value={password} onChangeText={setPassword} textAlign="left" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} secureTextEntry placeholder={locale === 'ar' ? '8 أحرف أو أكثر' : '8 characters or more'}/><Pressable accessibilityRole="button" disabled={busy} onPress={() => void submitEmail()} style={[styles.primary, busy && styles.disabled]}>{busy ? <ActivityIndicator color={palette.white}/> : <Text style={styles.primaryText}>{copy.continue}</Text>}</Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => void signInWithGoogle()} style={[styles.google, busy && styles.disabled]}><Text style={styles.googleMark}>G</Text><Text style={styles.googleText}>{copy.google}</Text></Pressable>{message ? <Text accessibilityRole="alert" style={[styles.message, { textAlign }]}>{message}</Text> : null}<View style={styles.switchRow}><Text style={styles.switchText}>{mode === 'sign-in' ? copy.account : copy.haveAccount}</Text><Pressable accessibilityRole="button" onPress={() => { setMessage(''); setMode((current) => current === 'sign-in' ? 'sign-up' : 'sign-in'); }}><Text style={styles.switchAction}>{mode === 'sign-in' ? copy.create : copy.login}</Text></Pressable></View></ScrollView></KeyboardAvoidingView></AppSurface>;
}

function Field({ label, textAlign, ...props }: { label: string; textAlign: 'left' | 'right' } & ComponentProps<typeof TextInput>) { return <View style={styles.field}><Text style={[styles.label, { textAlign }]}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor={palette.muted} style={[styles.input, { textAlign }]} /></View>; }
function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, page: { padding: 22, paddingBottom: 40, gap: 13 }, brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14 }, logo: { width: 48, height: 48, borderRadius: 15 }, wordmark: { fontSize: 29, color: palette.navy, fontWeight: '900' }, heading: { marginTop: 17, gap: 6 }, title: { color: palette.navy, fontWeight: '900', fontSize: 27 }, subtitle: { color: palette.muted, lineHeight: 21 }, field: { gap: 7 }, label: { color: palette.ink, fontWeight: '800', fontSize: 14 }, input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: '#F9FBFF', color: palette.ink, paddingHorizontal: 13, fontSize: 16 }, choiceRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, choice: { borderRadius: 999, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 13, paddingVertical: 9 }, choiceActive: { backgroundColor: palette.blue, borderColor: palette.blue }, choiceText: { color: palette.ink, fontWeight: '700' }, choiceTextActive: { color: palette.white }, privacy: { color: palette.muted, lineHeight: 18, fontSize: 12, marginTop: -2 }, primary: { minHeight: 51, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.blue, marginTop: 5 }, primaryText: { color: palette.white, fontWeight: '900', fontSize: 16 }, google: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: palette.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: palette.white }, googleMark: { color: '#4285F4', fontWeight: '900', fontSize: 20 }, googleText: { color: palette.ink, fontWeight: '800' }, disabled: { opacity: 0.55 }, message: { color: '#8E3434', backgroundColor: '#FFF3F3', padding: 12, borderRadius: 13, lineHeight: 20 }, switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 5 }, switchText: { color: palette.muted }, switchAction: { color: palette.blue, fontWeight: '900' },
});
