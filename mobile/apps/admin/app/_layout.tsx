import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AdminAuthProvider } from '../lib/admin-auth';

export default function RootLayout() {
  return <AdminAuthProvider><StatusBar style="light" /><Stack screenOptions={{ headerShown: false }} /></AdminAuthProvider>;
}
