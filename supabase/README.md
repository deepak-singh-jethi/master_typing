# Supabase source of truth

The migrations now contain a complete clean-environment baseline, the session-sync RPC, later compatibility migrations, and Phase 6 ownership hardening. The connected production-like `TYPING` project has the hardening migration and authenticated `delete-account` Edge Function deployed.

`tests/rls_ownership.sql` is the staging database gate. It verifies RLS, owner/second-account separation, anonymous denial, and RPC privileges. Run it only on a disposable or staging project.

Do not place a service-role key, database password, or secret key in this repository. The browser app uses only the Supabase project URL and publishable key. `delete-account` receives the service-role key only from Supabase-managed Edge Function secrets and requires a freshly issued verified user JWT.
