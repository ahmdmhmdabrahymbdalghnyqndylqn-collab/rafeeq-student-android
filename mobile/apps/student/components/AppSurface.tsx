import { type ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useLocale } from '../lib/locale';

export const palette = { navy: '#092E72', blue: '#0D6FEA', ice: '#EAF5FF', ink: '#102A56', white: '#FFFFFF', muted: '#63769B', border: '#DCEBFC' };
export function AppSurface({ children, style }: { children: ReactNode; style?: ViewStyle }) { const { direction } = useLocale(); return <SafeAreaView style={[styles.safe, { direction }, style]}><View style={styles.page}>{children}</View></SafeAreaView>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: palette.white }, page: { flex: 1, backgroundColor: palette.white } });
