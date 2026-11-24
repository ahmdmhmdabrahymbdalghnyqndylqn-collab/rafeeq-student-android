import { z } from 'zod';

const publicConfigSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  EXPO_PUBLIC_TEACHER_API_URL: z.string().url(),
});

export type PublicRuntimeConfig = z.infer<typeof publicConfigSchema>;

export function readPublicRuntimeConfig(source: Record<string, string | undefined>): PublicRuntimeConfig {
  return publicConfigSchema.parse(source);
}
