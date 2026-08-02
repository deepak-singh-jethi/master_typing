# Environment and secret ownership

| Concern | Local | Staging | Production |
|---|---|---|---|
| Client build | developer machine | immutable CI artifact | promoted immutable CI artifact |
| Supabase | optional developer project | `TYPING-STAGING` (`ttqbbpwvenltvtzjzkzh`) | `TYPING` (`wccgwbbxbrgxixhvyghq`) |
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

The staging project was provisioned on 2026-08-02 in `ap-southeast-1` after an explicit $0/month cost acknowledgement. Its publishable key belongs in the protected staging host variable and is intentionally not committed.
