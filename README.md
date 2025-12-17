# Zapshot Server (Node.js)

A compact Express server that powers the Zapshot backend — provides screenshot tooling, media download helpers, Google OAuth authentication, Checkout integration with Polar.sh, and a Cloud Run friendly image proxy.

---

## Quick start ✅

Prerequisites:
- Node.js (16+)
- npm or yarn
- MongoDB instance (local or remote)

Install and run:

```bash
# install deps
npm install

# dev (auto-restarts with nodemon)
npm run dev

# production
npm start
```

The server listens on PORT (defaults to 8080).

---

## Environment variables (important) 🔧

Create a `.env` file at the project root with the following keys (values depend on your setup):

```
PORT=8080
NODE_ENV=development
MONGO_URL=mongodb://localhost:27017/zapshot
SECRET=your_jwt_secret

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
CLIENT_REDIRECT_URL=...

# Polar (checkout & webhooks)
POLAR_ACCESS_TOKEN=...
POLAR_PRODUCT_ID=...
POLAR_PRODUCT_ID_BASIC=...
POLAR_WEBHOOK_SECRET=...

# Google service account for file upload
PROJECT_NAME=...
CLIENT_EMAIL=...
SERVICE_ACCOUNT_KEY=...   # use proper escaping for newlines
BUCKET_NAME=...

# Third-party APIs used by helpers
DEVELOPER_TOKEN=... (Product Hunt)
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...

# (Optional)
POLAR_PRODUCT_ID_BASIC=...
```

> Note: Do not commit secrets to git. Use CI/CD secret management or platform-specific env configuration (Cloud Run, Heroku, etc.).

---

## Main routes & usage 🔗

- Health: `GET /api/health` — basic healthcheck
- Image proxy: `GET /api/image-proxy?url={IMAGE_URL}` — fetches and returns remote images (Cloud Run friendly)
- Screenshots: `POST /api/screenshots` — screenshot-related logic (see `controllers/screenshots.js`)
- Google OAuth:
  - `GET /api/auth/google/signin` — start sign-in
  - `GET /api/auth/google/callback` — OAuth callback
- User:
  - `GET /api/user/get` — (auth required) returns user details
  - `POST /api/user/fake-post-download` — (auth required) internal download flow
- Tools: media download helpers under `/api/tools/*` (Twitter, Threads, Reddit endpoints)
- Polar Checkout: `POST /api/polar-checkout?plan=basic|pro` with `{ id }` in body (user id) — returns checkout URL
- Polar Webhook: `POST /polar/webhooks` — webhook endpoint used by Polar.sh for order events

---

## Authentication 🔐

- Google OAuth is wired via `passport-google-oauth20`. See `index.js` for strategy configuration.
- Protected routes use a Bearer JWT header validated by `middleware/isLoggedIn.js` (uses `SECRET`).

Example header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Project structure 📁

- `index.js` — server bootstrap, routes, and middleware
- `routes/` — API routing
- `controllers/` — handler logic for routes (e.g., `screenshots.js`, `tools.js`, `user.js`, `GoogleOAuth.js`)
- `helpers/` — scraper utilities and cloud upload helpers
- `models/` — MongoDB models (`User.js`)
- `middleware/` — authentication middleware
- `public/` — (optional) static files served for SPA fallback

---

## Deploy notes & Cloud Run tips ☁️

- Ensure env vars are configured in your deployment environment.
- Cloud Run expects the server to bind to `0.0.0.0` and the port in `PORT` — already used by `index.js`.
- Webhooks should be reachable from Polar.sh; configure `POLAR_WEBHOOK_SECRET` and validate delivery from Polar dashboard.

---

## Development tips & troubleshooting 💡

- Turn on verbose logs in `index.js` (there are helpful console logs for webhooks and the image proxy).
- For local development, set `NODE_ENV=development` and `CLIENT_REDIRECT_URL` accordingly.
- If image proxy fails, check timeout and network connectivity; the proxy enforces a 15s timeout.

---

## Contributing

Feel free to open issues or PRs. Keep changes small and add tests when adding features.

---

**License:** ISC

---

If you'd like, I can also add a sample `.env.example` file or include more detailed API examples (curl/postman snippets). ✨
