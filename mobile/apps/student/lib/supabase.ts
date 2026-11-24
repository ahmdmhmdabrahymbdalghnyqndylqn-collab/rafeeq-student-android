import * as SecureStore from 'expo-secure-store';
import { createRafeeqSupabaseClient } from '@rafeeq/core';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && publishableKey
  ? createRafeeqSupabaseClient(
    { EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey, EXPO_PUBLIC_TEACHER_API_URL: process.env.EXPO_PUBLIC_TEACHER_API_URL ?? 'https://rafeeq-private-teacher.ahmdmhmdabrahymbdalghnyqndylqn.workers.dev' },
    { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync, removeItem: SecureStore.deleteItemAsync },
  )
  : null;

export const supabaseIsConfigured = supabase !== null;
