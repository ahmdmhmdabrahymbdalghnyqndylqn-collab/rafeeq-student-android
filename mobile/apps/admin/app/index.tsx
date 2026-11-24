import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { AdminSurface, adminPalette } from '../components/AdminSurface';
import { useAdminAuth } from '../lib/admin-auth';

export default function EntryScreen() {
  const { state } = useAdminAuth();
  if (state === 'checking') return <AdminSurface><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={adminPalette.blue}/></View></AdminSurface>;
  if (state === 'unauthenticated') return <Redirect href="/sign-in"/>;
  if (state === 'forbidden') return <Redirect href="/access-denied"/>;
  return <Redirect href="/(tabs)"/>;
}
