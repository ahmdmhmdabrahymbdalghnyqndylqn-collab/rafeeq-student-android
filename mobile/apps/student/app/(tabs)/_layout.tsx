import { ActivityIndicator, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { AppSurface, palette } from '../../components/AppSurface';
import { useAuth } from '../../lib/auth';
import { useLocale } from '../../lib/locale';

export default function StudentTabsLayout() {
  const { t } = useLocale();
  const { configured, ready, session, profileReady, profileComplete } = useAuth();
  if (!ready) return <AppSurface><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={palette.blue} /></View></AppSurface>;
  if (configured && !session) return <Redirect href="/sign-in" />;
  if (configured && !profileReady) return <AppSurface><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={palette.blue} /></View></AppSurface>;
  if (configured && !profileComplete) return <Redirect href="/complete-profile" />;
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t('home') }} />
      <Tabs.Screen name="teacher" options={{ title: t('teacher') }} />
      <Tabs.Screen name="planner" options={{ title: t('planner') }} />
      <Tabs.Screen name="competition" options={{ title: t('competition') }} />
      <Tabs.Screen name="library" options={{ title: t('library') }} />
    </Tabs>
  );
}
