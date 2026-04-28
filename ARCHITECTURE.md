# TripSplit — Architecture Overview

## High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile PWA (React)                       │
│     Hosted on Emergent preview env, installable on phone    │
│                                                              │
│  React 18 · Tailwind · Framer Motion · Recharts · Axios     │
│                                                              │
│  Pages:  Login · Home · CreateTrip · TripDetail ·           │
│          AddExpense · Insights · Profile                    │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTPS  (JWT Bearer)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI (Python 3.11)                     │
│     Async with Motor MongoDB · Uvicorn · supervisord        │
│                                                              │
│  Routers:                                                    │
│   /api/auth/*    → JWT + bcrypt + Emergent Google OAuth     │
│   /api/trips/*   → CRUD + member mgmt                        │
│   /api/expenses  → inside trips/:id/expenses                 │
│   /api/settle    → simplified-debts algorithm                │
│   /api/ai/*      → 4 Gemini 3 Flash moments                  │
│   /api/fx        → currency conversion (USD-base)            │
└──────────┬──────────────────────────────────┬──────────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────┐            ┌──────────────────────────┐
│    MongoDB          │            │  emergentintegrations    │
│    (local pod)      │            │   → Gemini 3 Flash       │
│                     │            │   (Emergent Universal    │
│  Collections:       │            │    Key, pre-provisioned) │
│   users             │            │                          │
│   trips             │            │  auth.emergentagent.com  │
│   expenses          │            │   → Google OAuth         │
│   user_sessions     │            │                          │
│   login_attempts    │            └──────────────────────────┘
│   ai_cache          │
└─────────────────────┘
```

---

## Request flow examples

### 1. Login (JWT)
```
Phone/Browser ─POST /api/auth/login {email, password}──▶ FastAPI
   FastAPI queries users collection
   bcrypt.checkpw → ok
   JWT (HS256, exp=7d) signed with JWT_SECRET
◀─ { access_token, user: {...} } ─
Browser stores access_token in localStorage
```

### 2. Google login (Emergent managed)
```
User taps "Continue with Google" on /login
  → redirect to https://auth.emergentagent.com/?redirect=<our-origin>/
  Google handles all OAuth complexity
  User redirected back to our-origin/#session_id=ABC123
Frontend detects hash → POST /api/auth/google/session {session_id}
  Backend calls Emergent /session-data endpoint with X-Session-ID
  Gets email, name, picture
  find_or_create user (dedupe by email — matches email/pwd users)
  Issue our own JWT
◀─ { access_token, user } ─
```

### 3. AI Budget Estimator
```
User fills CreateTrip Step 1 (destinations, dates, members)
On Step 3 → taps "Estimate my budget"
  POST /api/ai/budget-estimate {destinations, days, people, currency, travel_style}
    → Backend builds structured prompt
    → emergentintegrations.LlmChat(model="gemini-3-flash-preview")
    → Gemini returns JSON string
    → Backend parses JSON, validates, returns
◀─ { stay, food, travel, activities, total, tips[], currency } ─
Frontend animates bars filling in with staggered Framer Motion delays
```

### 4. Smart Payment Notification (UPI simulation)
```
User on TripDetail taps "Simulate UPI payment"
Bottom sheet opens with quick prompts
User pastes "Paid ₹850 to Swiggy via GPay" → taps "Ask AI"
  POST /api/ai/smart-notify {raw_text}
    → Gemini returns {amount: 850, merchant: Swiggy, category: Food, ...}
◀─ toast.ai shows { "Looks like ₹850 at Swiggy — add to Food?" }
Toast has 2 actions: "Edit first" (opens AddExpense prefilled) or
                    "Confirm & add" (auto-creates expense)
```

### 5. Settlement simplification
```
GET /api/trips/:id/settlement
  Backend re-runs GET /api/trips/:id internally
  Compute balances: for each member, net = paid - share
  Greedy:
    creditors = sorted(balances>0 descending)
    debtors   = sorted(balances<0 descending magnitude)
    while both non-empty:
      pay = min(debtor[0], creditor[0])
      emit txn(debtor → creditor, pay)
      decrement both, pop whoever reaches 0
◀─ { transactions: [{from, to, amount}, ...] } ─
This produces at most (n-1) txns for n members — provably minimal.
```

---

## Security posture (prototype)

- bcrypt (cost=12 default) for passwords
- JWT HS256 with 64-char hex secret (rotate for prod)
- Brute-force lockout: 5 fails → 15-min block per `login:<email>` key
- CORS currently wildcard (acceptable for prototype; tighten to origin list for prod)
- MongoDB user_id is a custom `user_{uuid}` — internal `_id` NEVER exposed
- All DB reads use `{"_id": 0}` projection
- No secrets in frontend code; only `REACT_APP_BACKEND_URL` is exposed

---

## Deploy path

**Prototype (today):** Emergent preview env (auto-provisioned, one URL)
**Phase 2 (week 3+):**
1. Wrap React build with Capacitor → generate Android `.aab` + iOS `.ipa`
2. Publish to Play Store (internal testing track first)
3. Move MongoDB to managed Atlas (M0 free tier)
4. Move backend to Fly.io / Railway / Render free tier
5. Add Sentry for error tracking

---

## Scaling plan (if app goes viral)

| Bottleneck | Fix |
|---|---|
| N+1 queries in `GET /api/trips` | Aggregation pipeline joining trips + expense totals |
| Per-request AI latency (3-8s) | Add server-side cache (Redis) for deterministic prompts (fun-facts already cached) |
| Single backend pod | Horizontal scale via K8s HPA + stateless FastAPI (already stateless) |
| MongoDB writes | Add indexes (already on email, user_id, trip_id); shard by `owner_id` |
| Image hosting (cover images) | Move to Cloudinary or S3 + CDN (currently Unsplash direct) |

---

*Architecture review owner: Team Lead.*
