import { Tabs } from 'expo-router';

export default function AdminTabsLayout() {
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
