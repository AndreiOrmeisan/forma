# Free online accounts and private projects

The app supports Supabase Auth (Google OAuth) and PostgreSQL on the Supabase **Free** plan. GitHub Pages still hosts the frontend and the existing Render backend still calculates quantities/costs. No billing API, paid subscription, paid AI, email-sending service or automatic upgrade is implemented.

At the time of implementation (2026-11-13), Supabase Free advertises $0/month, a 500 MB database, 50,000 monthly active users and 5 GB egress. It can pause after a week of inactivity and does not include automatic database backups. These are provider limits, not an unlimited/free-forever guarantee. Stay on Free, do not enable paid add-ons, and check [official pricing](https://supabase.com/pricing) before creating resources. If limits are reached, review usage rather than purchasing an upgrade automatically.

## 1. Create your own Free project

1. Open [Supabase](https://supabase.com), create an account, and create a project in a **Free** organization. Do not select Pro, paid add-ons or billing upgrades.
2. Choose a region and set a database password. Keep that password private; FORMA does not need it in frontend configuration.
3. In the project's Connect/API settings, copy **Project URL** and **Publishable key** (`sb_publishable_...`). Legacy `anon` keys are also supported. Never use a secret key or `service_role` key.
4. Open SQL Editor and run [001_cloud_projects.sql](../backend/migrations/001_cloud_projects.sql). It creates the projects table, server timestamps/revisions and row-level ownership policies. No existing project data is dropped.

## 2. Enable free Google sign-in

Use [Supabase's Google OAuth setup guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-google). Google sign-in avoids the need to configure a separate email-delivery service for confirmation emails.

1. Create/configure a Google OAuth web client in Google Auth Platform. This setup does not require activating paid Google APIs or a paid email service.
2. Configure the OAuth consent screen, basic profile/email scopes, and the authorized callback URI shown in Supabase (normally `https://<project-ref>.supabase.co/auth/v1/callback`).
3. Add the Google Client ID and Client Secret in **Supabase Authentication → Providers → Google**, then enable the provider. The Google Client Secret stays in that dashboard; never put it in GitHub public variables, frontend code or this repository.
4. Configure the Google application's audience/publishing status. In Testing mode only explicitly listed test accounts can log in. To accept other visitors, complete Google's production publishing requirements; do not assume a test-only OAuth app allows everyone.
5. In **Supabase Authentication → URL Configuration**, set Site URL to `https://andreiormeisan.github.io/forma/` and add the exact redirect URL:

   `https://andreiormeisan.github.io/forma/domenii/mobilier/profil/`

   For local frontend testing also allow `http://localhost:3000/domenii/mobilier/profil/`.

## 3. Configure the Render backend

Add these environment variables as key/value pairs:

```text
ENABLE_CLOUD_PROJECTS=true
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_<your-public-key>
CORS_ORIGINS=https://andreiormeisan.github.io
FORMA_ENV=production
ENABLE_LOCAL_PROJECTS=false
```

Redeploy the backend with the updated source/dependencies. No Render disk or paid Render storage is needed: project data is in Supabase PostgreSQL. SQLite remains exclusively for optional local development.

## 4. Configure GitHub Pages

In repository **Settings → Secrets and variables → Actions → Variables**, set:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<your-public-key>
NEXT_PUBLIC_API_BASE_URL=https://forma-q8f6.onrender.com
```

The workflow injects these public values into the static build. Publish/rebuild the frontend only after configuring them. No secret/service-role key belongs here. CORS origin excludes the `/forma` path; the OAuth redirect URL includes it.

## 5. Verify before relying on it

1. Open the site, upload/configure a wardrobe and enter a name. Inputs must remain editable even before login.
2. Click Google sign-in. Allow the authentication popup. Complete login and return to the original tab; the temporary sketch and unsaved form stay there. The SDK synchronizes the session across tabs.
3. Save, reload, reopen, edit and save again. Use the same Google account on another device and verify the project appears there.
4. Use a second account and verify the first account's project list is empty/inaccessible, including direct UUID URLs. Test update, duplicate and delete authorization as well.
5. Verify the PostgreSQL table has RLS enabled, all four owner policies are installed, and anonymous access is denied. Test against the live configured database, not only backend mocks.
6. Without a bearer token cloud CRUD must return 401; another user's UUID must return 404. Anonymous calculation endpoints remain available.

Automated tests mock the external Auth/PostgREST service and exercise token verification, ownership filters, CRUD and revision checks. They do **not** prove that your live Supabase policies or Google OAuth dashboard settings have been deployed correctly. No external project/account was created or billed by implementing this code.

## Data, sessions and availability

Only configuration/pricing inputs are saved. Images stay temporary. The official Supabase SDK manages the browser session (including token refresh); the backend verifies identity with Supabase Auth on each project request and forwards that user's token to PostgreSQL's REST API. It never uses an administrative key. SQL RLS enforces `auth.uid() = owner_id`, independently of the API's owner filters. Clients cannot set owner IDs through FORMA endpoints.

Switching accounts clears the previous user's displayed project/draft state. Unsaved guest work is preserved during the first login. Logging out or switching accounts during editing can discard unsaved work; save first. A blocked popup gives an actionable error instead of redirecting away and losing the uploaded image.

Existing local SQLite projects are not automatically uploaded into an account. Cloud mode takes precedence over local mode when enabled. Missing configuration leaves cloud CRUD disabled; invalid or secret-key configuration fails startup rather than exposing unauthenticated storage. Provider failures never fall back to a shared public SQLite database. Free-plan pausing, provider quotas, and existing Render cold starts may temporarily affect availability. Keep independent backups/exported data; automatic backups and image cloud storage are outside this change.
