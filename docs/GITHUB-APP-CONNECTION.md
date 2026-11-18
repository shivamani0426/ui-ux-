# Frontline GitHub App OAuth setup (Milestone 14D)

GitHub App OAuth is optional and requires provider-owner configuration. The
existing user-approved, short-lived fine-grained token publisher remains intact.

## Configure

1. Create a GitHub App with homepage https://ui-compass-studio.onrender.com and
   user-authorization callback https://ui-compass-studio.onrender.com/auth/github/callback.
   Enable expiring user access tokens. Permissions: repository Contents read/write
   and Pull requests read/write. Install the App on selected repositories only.
2. Apply the bundled SQL migration to the Frontline Supabase project
   jzlgdxkefabahwecejov (not the unrelated JobPulse project).
3. In the Frontline Render service configure these server-only secrets:
   FRONTLINE_GITHUB_APP_CLIENT_ID (GitHub App client ID);
   FRONTLINE_GITHUB_APP_CLIENT_SECRET (GitHub App secret);
   FRONTLINE_GITHUB_ENCRYPTION_KEY (32 cryptographic random bytes in base64url);
   FRONTLINE_ACTION_SIGNING_SECRET (minimum 48 cryptographic random characters);
   FRONTLINE_SITE_URL (exact HTTPS site origin).
   Never put credentials in GitHub, browser bundles or chats.
4. Sign in with Google, open a saved approved design board, connect GitHub,
   publish a draft PR to a disposable repository, review that only explicitly
   Approved cards are included, disconnect and verify publish requires a
   fresh authorization. Test another browser and expired-token refresh.

## Security

PKCE, owner-bound signed state, HttpOnly Secure cookie, AES-256-GCM with account
owner as AAD, token rotation with compare-and-swap, and explicit encrypted
credential removal on disconnect/account deletion. Tokens never reach the
Frontline browser. Disconnect deletes Frontline's credentials; the user can
also revoke the GitHub App from GitHub's settings for provider-side revocation.

Real-provider acceptance is not done by mocked CI. Registering and authorizing
the App is an external operator/user action required before claiming completion.

Docs:
https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app
https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens
