import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppSurface, palette } from '../components/AppSurface';
import { useAuth } from '../lib/auth';
import { useLocale } from '../lib/locale';
import { normalizeStudentPhone, type SupportedCountry } from '../lib/profile-input';
import { supabase } from '../lib/supabase';

type Track = 'scientific' | 'literary' | 'math';
const countryCopy: Record<SupportedCountry, { ar: string; en: string }> = { EG: { ar: 'مصر', en: 'Egypt' }, JO: { ar: 'الأردن', en: 'Jordan' } };
const trackCopy: Record<Track, { ar: string; en: string }> = { scientific: { ar: 'علمي', en: 'Scientific' }, literary: { ar: 'أدبي', en: 'Literary' }, math: { ar: 'رياضي', en: 'Mathematics' } };

export default function CompleteProfileScreen() {
  const { locale, direction } = useLocale();
  const { session, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [country, setCountry] = useState<SupportedCountry>('EG');
  const [track, setTrack] = useState<Track>('scientific');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const textAlign = direction === 'rtl' ? 'right' : 'left';
  const copy = useMemo(() => locale === 'ar' ? { title: 'أكمل بيانات الطالب', body: 'نحتاج هذه البيانات مرة واحدة لحماية الحساب واستعادته على أي هاتف.', name: 'اسم الطالب', country: 'البلد', track: 'المسار الدراسي', phone: 'رقم الهاتف', save: 'حفظ والمتابعة', invalid: 'أدخل اسمًا صحيحًا ورقم هاتف مطابقًا لبلدك.', unavailable: 'تعذر الوصول إلى بيانات الحساب. حاول تسجيل الدخول مرة أخرى.' } : { title: 'Complete student profile', body: 'We need these details once to protect and recover your account on any phone.', name: 'Student name', country: 'Country', track: 'Study track', phone: 'Phone number', save: 'Save and continue', invalid: 'Enter a valid name and a phone number that matches your country.', unavailable: 'We could not access this account. Try signing in again.' }, [locale]);

  useEffect(() => {
    const client = supabase;
    if (!client || !session) return;
    const fallbackName = String(session.user.user_metadata.full_name ?? session.user.user_metadata.name ?? session.user.email?.split('@')[0] ?? '');
    setName(fallbackName);
    void client.from('profiles').select('display_name, country_code, study_track, phone_e164').eq('id', session.user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setName(data.display_name ?? fallbackName);
      if (data.country_code === 'EG' || data.country_code === 'JO') setCountry(data.country_code);
      if (data.study_track === 'scientific' || data.study_track === 'literary' || data.study_track === 'math') setTrack(data.study_track);
      if (data.phone_e164) setPhone(data.phone_e164);
    });
  }, [session]);

  const save = useCallback(async () => {
    const client = supabase;
    const phoneE164 = normalizeStudentPhone(country, phone);
    if (!client || !session) { setMessage(copy.unavailable); return; }
    if (name.trim().length < 2 || !phoneE164) { setMessage(copy.invalid); return; }
    setBusy(true); setMessage('');
    const { error } = await client.from('profiles').update({ display_name: name.trim(), country_code: country, study_track: track, phone_e164: phoneE164, preferred_locale: locale }).eq('id', session.user.id);
    if (error) setMessage(error.message);
    else { await refreshProfile(); router.replace('/'); }
    setBusy(false);
  }, [copy, country, locale, name, phone, refreshProfile, session, track]);

  return <AppSurface><KeyboardAvoidingView behavior={Platform.select({ ios: 'padding' })} style={styles.flex}><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><Text style={[styles.title, { textAlign }]}>{copy.title}</Text><Text style={[styles.body, { textAlign }]}>{copy.body}</Text><Field label={copy.name} value={name} onChangeText={setName} textAlign={textAlign} autoComplete="name"/><Text style={[styles.label, { textAlign }]}>{copy.country}</Text><View style={styles.choiceRow}>{(['EG', 'JO'] as const).map((value) => <Choice key={value} active={country === value} label={countryCopy[value][locale]} onPress={() => setCountry(value)}/>)}</View><Text style={[styles.label, { textAlign }]}>{copy.track}</Text><View style={styles.choiceRow}>{(['scientific', 'literary', 'math'] as const).map((value) => <Choice key={value} active={track === value} label={trackCopy[value][locale]} onPress={() => setTrack(value)}/>)}</View><Field label={copy.phone} value={phone} onChangeText={setPhone} textAlign="left" autoComplete="tel" keyboardType="phone-pad" placeholder={country === 'EG' ? '01XXXXXXXXX' : '07XXXXXXXX'}/><Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={[styles.primary, busy && styles.disabled]}>{busy ? <ActivityIndicator color={palette.white}/> : <Text style={styles.primaryText}>{copy.save}</Text>}</Pressable>{message ? <Text accessibilityRole="alert" style={[styles.message, { textAlign }]}>{message}</Text> : null}</ScrollView></KeyboardAvoidingView></AppSurface>;
}

function Field({ label, textAlign, ...props }: { label: string; textAlign: 'left' | 'right' } & ComponentProps<typeof TextInput>) { return <View style={styles.field}><Text style={[styles.label, { textAlign }]}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor={palette.muted} style={[styles.input, { textAlign }]} /></View>; }
function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, page: { padding: 22, paddingTop: 48, paddingBottom: 40, gap: 13 }, title: { color: palette.navy, fontSize: 28, fontWeight: '900' }, body: { color: palette.muted, lineHeight: 21, marginBottom: 8 }, field: { gap: 7 }, label: { color: palette.ink, fontWeight: '800', fontSize: 14 }, input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: '#F9FBFF', color: palette.ink, paddingHorizontal: 13, fontSize: 16 }, choiceRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, choice: { borderRadius: 999, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 13, paddingVertical: 9 }, choiceActive: { backgroundColor: palette.blue, borderColor: palette.blue }, choiceText: { color: palette.ink, fontWeight: '700' }, choiceTextActive: { color: palette.white }, primary: { minHeight: 51, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.blue, marginTop: 9 }, primaryText: { color: palette.white, fontWeight: '900', fontSize: 16 }, disabled: { opacity: 0.55 }, message: { color: '#8E3434', backgroundColor: '#FFF3F3', padding: 12, borderRadius: 13, lineHeight: 20 },
});
