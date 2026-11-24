# Supabase boundary

This folder intentionally contains no project reference, database password, or service-role key. Migrations are committed here, but are not applied until the Supabase project is explicitly connected.

When the approved database implementation begins:

1. Authenticate the Supabase CLI with a scoped token, not a personal unrestricted token.
2. Initialize the project configuration without committing any secret.
3. Review the committed migrations, then apply them to the linked project using a scoped token.
4. Enable RLS for every exposed table and test every policy.
5. Keep admin-only functions and service-role operations in Edge Functions; neither APK may contain those credentials.

The client configuration is shared through `packages/core/src/supabase.ts`. It accepts only an Expo public URL and a Supabase publishable key. RLS remains the enforcement boundary.
