import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LocaleProvider } from '../lib/locale';

export default function RootLayout() {
  return (
    <LocaleProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </LocaleProvider>
  );
}
