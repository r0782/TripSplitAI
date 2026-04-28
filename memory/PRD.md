# TripSplit — Product Requirements Document (PRD)

> **Internship project** — First end-to-end product build, 1.5-week sprint.
> **Team:** 3 members (Team Lead + 2 engineers).
> **Deadline:** 10 working days from kickoff.

---

## 1. Problem & vision

Travel expenses inside a group are messy. Existing apps (Splitwise, Tricount) solve the math, but they do NOTHING smart — you still type every line, pick categories manually, and guess your budget.

**TripSplit's pitch in one line:**
> "Travel together. Split smarter." — A mobile-first travel expense splitter where **AI does 80% of the grunt work.**

### What makes it different
1. AI **budget estimator** runs the moment you create a trip.
2. AI **categorises** every expense as you type.
3. AI **reads UPI / payment notifications** and offers one-tap add.
4. AI **generates fun facts** about your destination for the in-trip feed.
5. **Multi-currency** with auto conversion — built for travellers.
6. **Native-feeling mobile UX** — bottom nav, bottom-sheet modals, thumb-reach actions.

---

## 2. Target users & personas

| Persona | Who | Pain | TripSplit solves |
|---|---|---|---|
| **The Planner** (Team Lead-type student/young-pro) | Plans college/office trips, always stuck with math | "Who paid what, how much do I owe?" | Auto-split + settlement simplification |
| **The Casual Friend** | Just joins and pays | Doesn't log expenses properly | Smart UPI notification → one-tap add |
| **The Global Nomad** | Travels across countries | Currency math is brutal | Auto currency detection + live conversion |

---

## 3. Core features (implemented in prototype)

### Auth
- [x] Email + Password (JWT, bcrypt, brute-force lockout)
- [x] Emergent-managed **Google Login** (one-tap)
- [x] **Phone OTP (prototype)** — fixed code `123456`
- [x] Auto country + currency detection (user selects at signup, AI-auto-detect on travel)
- [x] Unified user collection across all auth methods (dedupe by email)

### Trips
- [x] Create trip — name, dates, destinations (chips), members, cover image, currency
- [x] List trips with total spent + cover image
- [x] Trip detail with tabs: Overview / Expenses / Settle
- [x] Add members post-creation (owner only)
- [x] 6 curated cover styles (Beach, Mountain, Island, City-EU, City-Asia, Desert)

### Expenses
- [x] Add expense with name, amount, currency, category, payer, split among
- [x] **AI auto-category tagger** (debounced as user types) — chip appears next to input
- [x] **Cross-currency support** — record in any currency, auto-converts to trip currency
- [x] Per-expense delete
- [x] Expense list with category emoji + payer + timestamp + amount

### AI Moments (4 features — all Gemini 3 Flash)
| # | Feature | Trigger | Output |
|---|---|---|---|
| 1 | **Budget Estimator** | After destinations/dates/members entered | Stay/Food/Travel/Activities breakdown + 3 tips + total |
| 2 | **Smart Payment Notification** | "Simulate UPI" button (prototype) | Merchant + amount + category + "Looks like..." message |
| 3 | **Auto Category Tagger** | As user types expense name | Category chip + emoji + confidence |
| 4 | **Fun Facts Feed** | Trip detail page loads | 6 destination fun facts with emoji + title + text |

### Dashboard & Settlement
- [x] Pie chart (Recharts) — per-member spend with 8-colour palette
- [x] Member balances — "Gets back / Owes / Settled" with net amount
- [x] **Simplified debts algorithm** — greedy match-largest-debtor-to-largest-creditor → produces minimum-transaction settlement
- [x] Mark settlement as paid (records as settlement expense)

### Insights (lifetime)
- [x] Total lifetime spent across all trips
- [x] Category pie chart across all trips
- [x] Per-trip bar chart
- [x] Trip list with quick navigation

### Profile
- [x] Name, email, picture
- [x] Home country / currency switcher (15 countries supported)
- [x] Logout

---

## 4. Tech architecture

### Stack
| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 (CRA) + Tailwind + Framer Motion + Recharts + lucide-react | Fastest path to live URL; mobile-first PWA works on any phone; one codebase for iOS/Android. |
| Backend | FastAPI (Python 3.11) + Motor async MongoDB | Async-first, great developer velocity, matches team's Python experience |
| Database | MongoDB | Flexible schema for expenses + members; perfect for nested trip docs |
| Auth | JWT (HS256) + Emergent Google OAuth + bcrypt | Industry standard; Emergent key = zero OAuth setup |
| AI | Gemini 3 Flash via `emergentintegrations` library + EMERGENT_LLM_KEY | Fast + cheap + structured-output support; single key for all Gemini/OpenAI/Claude |
| Hosting | Emergent preview env (live URL) | Zero devops; automatic HTTPS + domain |
| FX rates | Static dictionary (USD-base) fallback | Reliable for prototype; swap to CoinGecko/ExchangeRate-API for prod |

### Data Model (MongoDB)
```
users:           { user_id, email, name, password_hash, picture, home_country, home_currency, created_at }
trips:           { trip_id, owner_id, name, destinations[], start_date, end_date, currency, members[], cover_key, created_at }
  members:       { user_id, name, email, color }
expenses:        { expense_id, trip_id, name, amount, currency, amount_home, category,
                   paid_by, split_among[], place, paid_at, created_at }
user_sessions:   { session_token, user_id, expires_at, created_at }     # Emergent Google
login_attempts:  { identifier, count, locked_until }                      # brute force
ai_cache:        { kind, key, data, updated_at }                          # fun-facts cache
```

### API surface (22 endpoints)
```
Auth:         POST /api/auth/register | /login | /otp | /google/session | /logout
              GET  /api/auth/me        PATCH /api/auth/me
Trips:        POST /api/trips          GET /api/trips          GET /api/trips/:id
              POST /api/trips/:id/members
Expenses:     POST /api/trips/:id/expenses   DELETE /api/trips/:id/expenses/:eid
Settlement:   GET  /api/trips/:id/settlement POST /api/trips/:id/settle
AI:           POST /api/ai/budget-estimate | /categorize | /smart-notify
              GET  /api/ai/fun-facts?destination=
Util:         GET  /api/countries   GET /api/fx/:from/:to?amount=
              GET  /api/health
```

---

## 5. What's been implemented (as of Day 0 — today)
- Full backend (FastAPI + MongoDB + **30 endpoints** + 4 AI features + GridFS docs + invite links)
- Full frontend (10 screens, bottom nav, bottom sheets, toasts, pie chart, docs tab, share sheet, invite preview)
- Auth (email+password JWT + Emergent Google + prototype OTP)
- **Trip Invite Links** — share any trip via URL, anyone signs in → auto-added as member (with email-stub attach, rotation, public preview)
- **Trip Docs (GridFS)** — upload PDFs/images per trip, grid viewer, inline PDF & image preview, download, delete (uploader or owner)
- **100% backend test coverage (55/55 pytest cases pass — 28 original + 27 new)**
- Live URL working on mobile
- Demo user seed (`demo@tripsplit.app` / `Demo@123`)

## 6. What's deferred (Phase 2)

| Priority | Feature | Effort |
|---|---|---|
| P1 | **Real OTP** via Twilio ($) — replaces simulated 123456 | 1 day |
| P1 | **Live FX rates** — integrate CoinGecko / ExchangeRate-API | 0.5 day |
| P1 | **Real push notifications** for smart UPI on mobile (not just simulation) | 2 days (needs native layer) |
| P1 | **Invite-by-email** — accept {name, email} in TripCreateBody so pre-added members can claim via invite link (attach-by-email logic already in backend) | 0.5 day |
| P2 | **React Native wrapper** for Play Store / App Store publish via Capacitor | 2 days |
| P2 | Location-based auto-destination detection (geolocation) | 1 day |
| P2 | Group chat inside trip | 3 days |
| P2 | Export trip PDF report | 1 day |
| P2 | Refactor server.py into routers/ (auth, trips, invite, docs, ai) | 0.5 day |
| P3 | Dark mode toggle | 0.5 day |
| P3 | Recurring expenses (rent / subscription for long trips) | 1 day |
| P3 | OCR for receipt scanning (Tesseract or Gemini vision) | 2 days |

---

## 7. Success metrics (internship demo)

| Metric | Target |
|---|---|
| Core flows working | 100% (login → create trip → add expense → settlement) |
| Backend test pass | ≥ 95% (actual: 100%) |
| First meaningful paint on mobile | < 2s |
| AI response time | < 8s (Gemini 3 Flash: ~3-6s actual) |
| Live URL accessible from mentor's phone | ✅ |
| At least 1 novel feature vs Splitwise | ✅ (4 AI moments) |

---

## 8. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| AI API rate limits during demo | Low | Cached fun-facts; heuristic fallback on all AI endpoints |
| Mobile browser compatibility (iOS Safari) | Medium | Tested on 430×900 viewport; safe-area insets used |
| Demo user data contamination | Low | Each test run prefixes data; easy cleanup |
| OTP is mocked (not real) | Medium | Disclosed in UI ("Prototype build") + documented in PRD as P1 Phase 2 |
| CORS on cookie-based Google auth | Low | Bearer-token path works; explicit origin list recommended for prod |

---

*Document owner: Team Lead. Last updated: Day 0.*
