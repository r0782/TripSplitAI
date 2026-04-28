# TripSplit Auth Testing Playbook

## Demo User
- Email: `demo@tripsplit.app`
- Password: `Demo@123`

## Login via API (JWT)
```bash
curl -X POST "$BACKEND/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@tripsplit.app","password":"Demo@123"}'
# returns { access_token, token_type: "bearer", user: {...} }
```

Then use:
```bash
curl "$BACKEND/api/auth/me" -H "Authorization: Bearer $TOKEN"
```

## Prototype OTP
```bash
curl -X POST "$BACKEND/api/auth/otp" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+919999999999","otp":"123456","name":"Test"}'
```

## Google Auth (Emergent managed)
1. Frontend redirects to `https://auth.emergentagent.com/?redirect=<origin>/`
2. Callback returns `#session_id=...` in URL hash
3. Frontend POSTs to `/api/auth/google/session` with `{session_id}` → receives JWT

## Browser Testing
Once JWT obtained, set in localStorage as `ts_token`:
```javascript
await page.evaluate((t) => localStorage.setItem('ts_token', t), token);
await page.evaluate((u) => localStorage.setItem('ts_user', JSON.stringify(u)), user);
await page.goto(base + "/");
```

## Expected Success Indicators
- `/api/auth/me` returns user with `user_id`, `email`, `name`, `home_currency`
- `/` (home) loads without redirect to `/login`
- `/api/trips` returns [] or trip list for the demo user
