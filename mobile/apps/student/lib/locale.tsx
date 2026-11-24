import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Locale = 'ar' | 'en';
type Dictionary = Record<string, string>;

const copy: Record<Locale, Dictionary> = {
  ar: {
    home: 'الرئيسية', teacher: 'المعلم الخاص', planner: 'جدولي', competition: 'المنافسة', library: 'المكتبة',
    greeting: 'أهلًا بك في Rafeeq', organize: 'نظّم وقتك', upcoming: 'مهمتك القادمة', progress: 'تقدّمك اليوم',
    startStudy: 'ابدأ جلسة الدراسة', askTeacher: 'اسأل المعلم الخاص', thinking: 'جاري تجهيز إجابة دقيقة…',
    noTask: 'لا توجد مهمة قادمة', language: 'اللغة', arabic: 'العربية', english: 'English', settings: 'الإعدادات',
    libraryHint: 'اقرأ أو نزّل كتبك مباشرةً إلى هاتفك', competitionHint: 'تحدَّ طالبًا آخر في منافسة عادلة',
    teacherHint: 'اسأل، راجع، أو أنشئ امتحانًا مخصصًا', welcome: 'رفيقك لتنظيم الدراسة والتعلّم بذكاء', logout: 'تسجيل الخروج', signedInAs: 'مسجّل باسم',
  },
  en: {
    home: 'Home', teacher: 'Private Teacher', planner: 'My Plan', competition: 'Competition', library: 'Library',
    greeting: 'Welcome to Rafeeq', organize: 'Organize your time', upcoming: 'Your next task', progress: 'Today’s progress',
    startStudy: 'Start study session', askTeacher: 'Ask the private teacher', thinking: 'Preparing a thoughtful answer…',
    noTask: 'No upcoming task', language: 'Language', arabic: 'العربية', english: 'English', settings: 'Settings',
    libraryHint: 'Read or download your books directly to your phone', competitionHint: 'Challenge another student fairly',
    teacherHint: 'Ask, revise, or create a tailored exam', welcome: 'Your companion for organized, smarter study', logout: 'Sign out', signedInAs: 'Signed in as',
  },
};

type LocaleContextValue = { locale: Locale; direction: 'rtl' | 'ltr'; t: (key: keyof typeof copy.ar) => string; setLocale: (locale: Locale) => Promise<void>; ready: boolean };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ar');
  const [ready, setReady] = useState(false);
  useEffect(() => { SecureStore.getItemAsync('rafeeq.locale').then((saved) => { if (saved === 'ar' || saved === 'en') setLocaleState(saved); }).finally(() => setReady(true)); }, []);
  const setLocale = useCallback(async (next: Locale) => { setLocaleState(next); await SecureStore.setItemAsync('rafeeq.locale', next); }, []);
  const value = useMemo(() => ({ locale, direction: locale === 'ar' ? 'rtl' as const : 'ltr' as const, t: (key: keyof typeof copy.ar) => copy[locale][key], setLocale, ready }), [locale, ready, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() { const value = useContext(LocaleContext); if (!value) throw new Error('useLocale must be used within LocaleProvider'); return value; }
