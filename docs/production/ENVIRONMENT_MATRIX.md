# Environment and secret ownership

| Concern | Local | Staging | Production |
|---|---|---|---|
| Client build | developer machine | immutable CI artifact | promoted immutable CI artifact |
| Supabase | optional developer project | separate project required | `TYPING` (`wccgwbbxbrgxixhvyghq`) |
| Project URL | `.env.local` | protected host variable | protected host variable |
| Publishable key | `.env.local` | protected host variable | protected host variable |
| Service-role key | never available to Vite | Edge Function secret only | Edge Function secret only |
| Build ID | `development` | commit SHA | same promoted commit SHA |
| Auth redirects | localhost exact URL | exact staging URL | exact production URL |

Rules:

- Staging and production must never share a Supabase project.
- `.env.local`, database passwords, secret keys, tokens, and service-role keys are never committed or placed in `VITE_*` variables.
- The browser receives only the project URL and publishable key. RLS remains the authorization boundary.
- Redirect allowlists contain exact deployed URLs; wildcards are prohibited.
- Key rotation requires updating the protected environment value, rebuilding, testing staging, then promoting the same source.

The staging Supabase project is intentionally recorded as **not yet provisioned**. Creating a project or branch has a recurring cost and requires a separate explicit cost confirmation before it can be automated.
