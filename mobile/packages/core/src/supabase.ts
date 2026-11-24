import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { PublicRuntimeConfig } from './config';

export type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export function createRafeeqSupabaseClient(
  config: PublicRuntimeConfig,
  storage: KeyValueStorage,
): SupabaseClient {
  return createClient(config.EXPO_PUBLIC_SUPABASE_URL, config.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
