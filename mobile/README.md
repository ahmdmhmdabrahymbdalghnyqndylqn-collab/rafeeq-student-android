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

## Supabase activation checklist

The repository contains migrations only; none have been applied from this workspace because no Supabase project is linked here. Before enabling accounts, competition, or the admin APK:

1. Link the intended Supabase project and apply every file in `supabase/migrations` in order.
2. In Supabase Auth, enable Email/Password and configure email confirmation/recovery.
3. For Google login, enable the Google provider and add `rafeeq://auth/callback` to **Authentication → URL Configuration → Redirect URLs**.
4. Create the first administrator only from a trusted SQL session by adding that user's `auth.users.id` to `public.admin_users`. Do not put an admin or service-role key into either APK.
5. Add only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the CI/build environment. These are public by design; RLS remains the authorization boundary.

The student profile trigger creates the profile from verified signup metadata. Google users are forced through the in-app profile-completion screen to choose country, track, and a validated Egyptian or Jordanian number before accessing student screens.

## Android APKs

For a local debug run use `pnpm android:student` or `pnpm android:admin`.
Production signing keys are local/CI secrets and must never be committed. Before replacing the already-installed student APK, preserve its application ID and signing key so Android accepts it as an update.

GitHub Actions creates separate `rafeeq-student-apk` and `rafeeq-admin-apk` artifacts after type checks, lint, Jest, Expo prebuild, and Gradle release assembly. An artifact is not a published release link until it has passed the required device-install test.

## Environment safety

`EXPO_PUBLIC_*` variables are readable by anyone who installs the APK. They may contain the Supabase URL and publishable key only; access control is enforced by Supabase RLS. The Supabase `service_role` key and Cloudflare management token belong only in a server secret store.
