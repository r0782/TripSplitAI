# TripSplit — 10-Day Sprint Roadmap + Team Task Split

> **Total: 10 working days (≈ 1.5 weeks)** · **Team size: 3** (1 Team Lead + 2 Engineers)

---

## 🎯 Sprint goals (in order of priority)
1. **Days 1-2** — Foundation: auth, data model, routing, design system
2. **Days 3-5** — Core split features: trips, expenses, settlement
3. **Days 6-7** — AI features: all 4 Gemini moments wired in
4. **Days 8-9** — Polish: currency, fun-facts, insights, mobile feel
5. **Day 10** — Test, demo, submit

---

## 👥 Team roles

### **You (Team Lead / Full-stack)**
- Owns architecture, AI features, deployment, demo
- Reviews all PRs
- Runs daily 10-min standups
- Handles blockers

### **Engineer A — Backend-heavy full-stack**
- Owns auth, trips CRUD, expenses, settlement algorithm, DB indexes
- Writes all backend tests
- Skills needed: Python/FastAPI basics, MongoDB basics (picks up in day 1)

### **Engineer B — Frontend-heavy full-stack**
- Owns React screens, Tailwind styling, Framer Motion, bottom-sheet patterns, pie chart
- Owns mobile polish + responsive testing
- Skills needed: React basics, CSS/Tailwind (picks up in day 1)

> **Pair ethos**: Daily 30-min pairing between Eng-A and Eng-B to sync the contract (API shape → component consumption).

---

## 📅 Day-by-day plan

### **Day 1 — Monday · Kickoff + Foundation**
**Goal:** Everyone has a running local env + agreed contracts.

| Person | Tasks |
|---|---|
| **Lead** | • Present PRD + flowcharts (from `flow1-4.svg`) · • Assign GitHub roles · • Set up `.env`, Mongo, Python, Node · • Write API contract doc (endpoint → request/response shape) · • Agree on branching (`main` / `feat/*`) |
| **Eng A** | • Install Python/FastAPI/Motor · • Copy provided `server.py` skeleton · • Get `/api/health` + `/api/auth/register` + `/login` working locally · • MongoDB indexes |
| **Eng B** | • Install Node/yarn/React · • Tailwind + Framer Motion + Recharts + lucide setup · • Build `MobileFrame` + `BottomNav` + `BottomSheet` shells · • Import design tokens from `design_guidelines.json` |

**Deliverable EOD**: Both servers run. Demo user logs in from curl. Empty-state Home screen renders.

---

### **Day 2 — Tuesday · Auth + Routing**
**Goal:** Sign-up, login, Google, OTP-mock → home screen flow complete.

| Person | Tasks |
|---|---|
| **Lead** | • Integrate Emergent Google Auth (frontend redirect + `/api/auth/google/session` backend) · • Test from real mobile browser · • Help Eng A with bcrypt issues if any |
| **Eng A** | • JWT helpers · • Brute-force protection (`login_attempts` collection) · • OTP endpoint (prototype 123456) · • Seed demo user · • `/api/auth/me` dependency |
| **Eng B** | • `Login` + `Register` screens · • `AuthContext` with localStorage token · • `AuthCallback` page for `#session_id=...` · • Toasts (Sonner or custom) |

**Deliverable EOD**: Full auth works end-to-end on `https://<preview>.preview.emergentagent.com`.

---

### **Day 3 — Wednesday · Trips (create + list)**
**Goal:** Create a trip. See it on Home.

| Person | Tasks |
|---|---|
| **Lead** | • Code review · • Cover image selection (6 options in `COVER_OPTIONS`) · • Design polish of create-trip stepper |
| **Eng A** | • `POST /api/trips`, `GET /api/trips`, `GET /api/trips/:id` · • Trip ownership check, member add · • Unit tests for these |
| **Eng B** | • `Home` screen (trip cards with cover + dates + members) · • `CreateTrip` 3-step stepper (Basics → Members → Review) · • Destination + member chip inputs |

**Deliverable EOD**: Demo flow: Login → Home → "Create Trip" → Trip appears on Home.

---

### **Day 4 — Thursday · Expenses**
**Goal:** Add expenses. See them in a list. See the pie chart.

| Person | Tasks |
|---|---|
| **Lead** | • Recharts pie chart integration · • Palette colors per member · • Test on multiple members (6+ members) |
| **Eng A** | • `POST/DELETE /api/trips/:id/expenses` · • Compute `per_member_paid`, `per_category`, `balances` on `GET /api/trips/:id` · • Currency conversion helper with static USD-base rates |
| **Eng B** | • `TripDetail` — tabs (Overview/Expenses/Settle) · • `AddExpense` bottom sheet · • Category grid, payer chips, split toggles |

**Deliverable EOD**: Add 3 expenses → pie chart renders with correct split.

---

### **Day 5 — Friday · Settlement (who owes whom)**
**Goal:** "Settle up" tab shows minimum transactions.

| Person | Tasks |
|---|---|
| **Lead** | • Code review · • Write the **simplified-debts algorithm** with Eng A (greedy match largest creditor ↔ debtor) · • Validate with test cases (3-person cycle, 5-person fan-out) |
| **Eng A** | • `GET /api/trips/:id/settlement` returns `transactions[]` · • `POST /api/trips/:id/settle` records a settlement expense · • Edge cases (rounding, zero balance) |
| **Eng B** | • `SettleView` component · • Per-transaction "Mark as paid" button · • Balance rows with color-coded "Gets back / Owes" |

**Deliverable EOD**: 3 members, several expenses → settlement shows ≤ (n-1) transactions.

**🍕 Weekend check-in (optional)**: Demo current build to 2 friends. Collect feedback.

---

### **Day 6 — Monday · AI Budget Estimator + Auto-Tagger**
**Goal:** Two AI moments live.

| Person | Tasks |
|---|---|
| **Lead** | • `POST /api/ai/budget-estimate` + `POST /api/ai/categorize` with Gemini 3 Flash via `emergentintegrations` · • Structured-JSON prompts · • Heuristic fallbacks |
| **Eng A** | • Backend tests for both AI endpoints · • `ai_cache` collection (for fun-facts tomorrow) · • Add AI key to `.env` |
| **Eng B** | • `AILoading` shimmer component · • Budget estimator card in CreateTrip Step 3 with animated bars · • Auto-category chip next to expense name input (debounced 700ms) |

**Deliverable EOD**: Creating a "Goa 4 days 3 people" trip → AI card shows ₹64K total with breakdown. Typing "Dinner at Swiggy" shows "Food 🍽" chip.

---

### **Day 7 — Tuesday · AI Smart Notification + Fun Facts**
**Goal:** Remaining two AI moments live.

| Person | Tasks |
|---|---|
| **Lead** | • `POST /api/ai/smart-notify` — parse UPI text · • `GET /api/ai/fun-facts` with cache · • Demo 4 sample UPI prompts (Swiggy, Uber, Starbucks, Resort) |
| **Eng A** | • Backend tests for both · • Ensure 6 facts returned, cache hit on 2nd call |
| **Eng B** | • "Simulate UPI payment" bottom sheet with quick-prompt chips · • Smart toast notification (`toast.ai(...)`) with Confirm/Edit CTA · • Fun-facts horizontal scroll cards on TripDetail (snap scrolling) |

**Deliverable EOD**: Tap "Simulate UPI" → paste "Paid ₹850 to Swiggy via GPay" → AI suggests add as Food → one-tap confirms. Trip detail shows 6 Goa fun-fact cards.

---

### **Day 8 — Wednesday · Multi-currency + Insights + Profile**
**Goal:** Global travel polish.

| Person | Tasks |
|---|---|
| **Lead** | • Cross-currency expense testing (USD expense on INR trip → correct conversion) · • Review Insights pie + bar charts |
| **Eng A** | • `GET /api/countries` + `/api/fx/:from/:to?amount=` · • Auto-update `home_currency` when `home_country` patched |
| **Eng B** | • `Profile` screen with country list (15 options, flag + currency code) · • `Insights` screen — lifetime total + category pie + per-trip bar · • Currency preview below amount input |

**Deliverable EOD**: Switch profile country → all new expenses default to that currency. Insights page shows aggregated spend.

---

### **Day 9 — Thursday · End-to-end polish + testing**
**Goal:** The "wow" of a near-final product.

| Person | Tasks |
|---|---|
| **Lead** | • Call testing agent for full backend + frontend E2E · • Fix all P0/P1 bugs · • Record 2-min demo video on phone |
| **Eng A** | • Fix backend bugs from test report · • Performance: add missing indexes if any · • Add `401` → redirect-to-login interceptor |
| **Eng B** | • Fix frontend bugs · • Add empty states to Home, Insights · • Add loading skeletons (no flashes of unstyled content) · • Mobile browser test (iOS Safari + Android Chrome) |

**Deliverable EOD**: Everything works. Zero critical bugs. Demo video recorded.

---

### **Day 10 — Friday · Ship + demo**
**Goal:** Submit to internship mentor.

| Person | Tasks |
|---|---|
| **Lead** | • Final PRD + README polish · • Architecture diagram (draw.io) · • Demo video upload · • Slide deck (10 slides max) · • Email submission |
| **Eng A** | • Write API reference doc (endpoints + request/response samples) · • Unit test coverage report |
| **Eng B** | • Screenshots for README · • GIF of AI moments · • Lighthouse audit (aim ≥ 90 on mobile) |

**Ship it! 🚀**

---

## 🧭 Daily rituals

| When | What | Owner |
|---|---|---|
| 10:00 AM | 10-min standup — yesterday / today / blockers | Lead runs |
| 12:00 PM | Quick sync — API contracts between BE and FE | Eng A ↔ Eng B |
| 5:00 PM | Push + PR review (no unreviewed merges to `main`) | Lead reviews |
| 6:30 PM | EOD screenshot posted in team chat | Everyone |

---

## 📚 Git branching

```
main                ← protected, only merged via PR
 ├── feat/auth      ← Eng A
 ├── feat/trips     ← Eng A
 ├── feat/ai-*      ← Lead
 ├── feat/ui-*      ← Eng B
 └── fix/*          ← anyone
```

PRs require: description, screenshot (for UI), Lead's approval.

---

## 🚨 Red flags to escalate

1. Any day ends without a running product → **pause features, restore first**
2. AI endpoint taking > 15s → ask Lead to check Gemini quota / swap model
3. "It works on localhost but not preview URL" → env var issue, ask Lead

---

## 🏆 Definition of Done (per feature)

- [ ] Backend endpoint tested with curl → returns expected JSON
- [ ] Frontend renders data with correct UI state
- [ ] Mobile view (430px wide) looks correct
- [ ] `data-testid` attrs on all interactive elements
- [ ] No console errors
- [ ] Empty state designed (not just a blank screen)
- [ ] Loading state designed (skeleton or spinner)
- [ ] Error state designed (toast or inline message)
- [ ] Code reviewed + merged to `main`

---

## 💬 FAQ for new team members

**Q: What if I've never used FastAPI / React before?**
A: That's fine. Day 1 is buffer. Lead will pair with you for 2 hours. FastAPI = "Express.js for Python". React = "HTML + JS mixed together (JSX), with state hooks."

**Q: What about the AI prompts — do we need to fine-tune?**
A: No. Gemini 3 Flash with structured JSON prompts is enough. Prompts are in `server.py` — tweak text, never change library calls.

**Q: How do we handle production secrets?**
A: Never commit `.env`. Use the Emergent-provided `EMERGENT_LLM_KEY` — it's already scoped to our account.

**Q: What if deadline slips?**
A: Cut AI #3 and #4 (smart-notify + fun-facts). Budget estimator + auto-tagger are the showstoppers.
