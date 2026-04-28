# TripSplit — Test Credentials

## Demo User (Email/Password, pre-seeded)
- Email: `demo@tripsplit.app`
- Password: `Demo@123`
- Name: Demo Traveler
- Home country: IN
- Home currency: INR

## Authentication Endpoints
- POST `/api/auth/register` — create a new user
- POST `/api/auth/login` — JWT login (email + password)
- POST `/api/auth/otp` — simulated OTP login (use OTP `123456`)
- POST `/api/auth/google/session` — Emergent Google Auth callback
- GET `/api/auth/me` — current user (JWT Bearer token OR Emergent session_token)
- PATCH `/api/auth/me` — update name/home_country/home_currency
- POST `/api/auth/logout` — logout

## Invite & Docs Endpoints (iteration 2)
- GET `/api/trips/:id/invite` — member-only, returns `{invite_token, trip_name}`
- POST `/api/trips/:id/invite/rotate` — owner-only, new token invalidates old
- GET `/api/invite/:token/preview` — PUBLIC (no auth) — returns trip summary
- POST `/api/invite/:token/accept` — auth required, adds current user as member (idempotent)
- POST `/api/trips/:id/docs` — multipart upload (PDF/PNG/JPG/WEBP/HEIC/GIF, ≤10 MB)
- GET `/api/trips/:id/docs` — list docs metadata
- GET `/api/trips/:id/docs/:doc_id` — stream file (Bearer header OR `?token=<JWT>` query)
- DELETE `/api/trips/:id/docs/:doc_id` — uploader or trip owner only

## Auth Token Patterns
1. **Email/Password JWT**: send `Authorization: Bearer <access_token>` header.
2. **Google Auth**: browser handles flow via `https://auth.emergentagent.com/?redirect=...`, returns `#session_id=...` in URL hash. The `/api/auth/google/session` endpoint exchanges that for both a JWT and stores a 7-day session.
3. **Prototype OTP**: any phone + fixed OTP `123456` creates/returns user.

## Brute Force
5 failed logins → 15 min lockout per identifier `login:<email>`.

## Notes
- Sample trip for demo user is created when the user adds one via UI (no seed trips).
- MongoDB collections: `users`, `trips`, `expenses`, `user_sessions`, `login_attempts`, `ai_cache`.
