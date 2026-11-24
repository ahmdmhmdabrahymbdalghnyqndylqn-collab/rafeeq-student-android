import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const adminPalette = { navy: '#071F4D', blue: '#0B70F0', sky: '#DDEEFF', page: '#F5F9FF', card: '#FFFFFF', ink: '#102A56', muted: '#65789A', border: '#D6E5F8', danger: '#B6353B', success: '#13865D', warning: '#B46A00' };

export function AdminSurface({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <SafeAreaView style={[styles.safe, style]}><View style={styles.page}>{children}</View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: adminPalette.page }, page: { flex: 1, backgroundColor: adminPalette.page } });
