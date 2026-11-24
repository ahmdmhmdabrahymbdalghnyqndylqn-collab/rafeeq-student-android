# Rafeeq Mobile

Monorepo for the two Android applications of Rafeeq:

- `apps/student`: the student-facing application (`com.rafeeq.student`).
- `apps/admin`: the administrator-only dashboard application (`com.rafeeq.admin`).
- `packages/core`: shared typed configuration, Supabase client factory, and domain types.

Both APKs use the same Supabase project, but the admin APK never receives a service-role key. Administrative actions must be enforced by RLS and Edge Functions using server-side roles.

## Requirements

- Node.js 22+
- pnpm 11+
- Android Studio, Android SDK, and a physical device or emulator for Android builds

## First run

1. Copy `.env.example` to `.env` and enter only public runtime configuration.
2. Run `pnpm install` in this folder.
3. Run `pnpm dev:student` or `pnpm dev:admin`.
4. Run `pnpm typecheck && pnpm lint && pnpm test` before every pull request.

## Android APKs

For a local debug run use `pnpm android:student` or `pnpm android:admin`.
Production signing keys are local/CI secrets and must never be committed. Before replacing the already-installed student APK, preserve its application ID and signing key so Android accepts it as an update.

## Environment safety

`EXPO_PUBLIC_*` variables are readable by anyone who installs the APK. They may contain the Supabase URL and publishable key only; access control is enforced by Supabase RLS. The Supabase `service_role` key and Cloudflare management token belong only in a server secret store.
