import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { AppSurface, palette } from '../components/AppSurface';
import { useAuth } from '../lib/auth';

export default function EntryScreen() {
  const { configured, ready, session, profileReady, profileComplete } = useAuth();
  if (!ready) return <AppSurface><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={palette.blue} /></View></AppSurface>;
  if (configured && !session) return <Redirect href="/sign-in" />;
  if (configured && !profileReady) return <AppSurface><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={palette.blue} /></View></AppSurface>;
  if (configured && !profileComplete) return <Redirect href="/complete-profile" />;
  return <Redirect href="/(tabs)" />;
}
