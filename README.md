# SocialSpark API

Express API for SocialSpark events, joins and Better Auth. MongoDB stores users, sessions, events and participation.

**Live API:** https://social-spark-api.vercel.app

## Setup

1. Copy `.env.example` to `.env` and set `MONGO_URI` and a random `BETTER_AUTH_SECRET` (at least 32 characters).
2. Set `APP_URL` to the public client URL. For local development, use `http://localhost:3000`.
3. To enable GitHub login, create a GitHub OAuth app with callback URL `<APP_URL>/api/auth/callback/github`, then set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
4. Run `npm ci` and `npm start`.
5. Run `npm run seed` once with the same MongoDB settings to add six real upcoming event documents. Rerunning it refreshes those six dates without creating duplicates.

The client proxies `/api/*` to this server. Set its `API_ORIGIN` to this server's origin before building or deploying the client.

Public endpoints: `GET /api/events`, `GET /api/events/recent`, `GET /api/events/:id`.
JWT-protected endpoints: `GET /api/me/events`, `GET /api/me/joins`, `POST /api/events`, `PATCH /api/events/:id`, `DELETE /api/events/:id`, `POST /api/events/:id/join`.

The health endpoint checks the MongoDB connection. Never commit `.env` or OAuth credentials.

For Vercel, this repository exports the Express application from `index.js`; set `MONGO_URI`, `MONGO_DB`, `BETTER_AUTH_SECRET`, and `APP_URL` in the project environment. `APP_URL` must be the client site URL, and the client project must set `API_ORIGIN` to this API's public origin.
