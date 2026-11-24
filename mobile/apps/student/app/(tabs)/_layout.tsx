import { Tabs } from 'expo-router';
import { useLocale } from '../../lib/locale';

export default function StudentTabsLayout() {
  const { t } = useLocale();
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
