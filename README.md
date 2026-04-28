# TripSplit 🌴

> **Travel together. Split smarter.** A mobile-first PWA that makes travel expense splitting feel magical with 4 AI-powered moments.

**Live demo:** https://fff7acd7-0a35-47dd-ab88-cf1ef443a0bb.preview.emergentagent.com
**Demo login:** `demo@tripsplit.app` / `Demo@123`

---

## ✨ What's special

Unlike Splitwise/Tricount, **AI does 80% of the work**:

1. 🎯 **AI Budget Estimator** — tells you stay/food/travel/activities breakdown before the trip
2. 📱 **Smart Payment Notification** — parses UPI text, suggests auto-add with one tap
3. 🏷 **Auto Category Tagger** — categorises expense as you type (debounced)
4. 🗺 **Fun Facts Feed** — scrolling destination trivia inside every trip

Plus **multi-currency with auto conversion**, **simplified debts algorithm**, **Emergent Google login**, and a native-feeling mobile UX.

---

## 🏗 Tech stack

- **Frontend:** React 18 · Tailwind · Framer Motion · Recharts · lucide-react
- **Backend:** FastAPI · Motor (async MongoDB) · Python 3.11
- **AI:** Gemini 3 Flash via `emergentintegrations` library (Emergent Universal LLM Key)
- **Auth:** JWT (email/password + bcrypt) + Emergent-managed Google OAuth + prototype phone OTP

---

## 📂 Repo layout

```
/app
├── backend/
│   ├── server.py            # All 22 endpoints (auth, trips, expenses, AI, FX)
│   ├── .env                 # MONGO_URL, JWT_SECRET, EMERGENT_LLM_KEY, demo creds
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.js           # Router + Google OAuth hash detection
│   │   ├── contexts/        # AuthContext, ToastContext
│   │   ├── components/      # MobileFrame, BottomNav, BottomSheet, PieChartBreakdown, …
│   │   ├── pages/           # Login, Home, CreateTrip, TripDetail, AddExpense, Insights, Profile
│   │   └── lib/api.js       # Axios, currency helpers, category map
│   ├── tailwind.config.js   # Design tokens
│   └── package.json
├── memory/
│   ├── PRD.md               # Product requirements
│   └── test_credentials.md  # Demo user, test endpoints
├── TRIPSPLIT_ROADMAP.md     # 10-day sprint plan + team task split
├── ARCHITECTURE.md          # Full architecture + request flows
├── auth_testing.md          # Auth testing playbook
└── design_guidelines.json   # Design system
```

---

## 🚀 Quick start (local)

```bash
# Backend
cd backend
pip install -r requirements.txt
python server.py                # or via supervisor

# Frontend
cd frontend
yarn install
yarn start                      # opens http://localhost:3000
```

Set `/app/backend/.env`:
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="tripsplit"
JWT_SECRET="<random-64-char-hex>"
EMERGENT_LLM_KEY="<provided by Emergent>"
DEMO_EMAIL="demo@tripsplit.app"
DEMO_PASSWORD="Demo@123"
DEMO_NAME="Demo Traveler"
```

Set `/app/frontend/.env`:
```
REACT_APP_BACKEND_URL=<your backend URL>
```

---

## 🧪 Test from curl

```bash
# Login
TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@tripsplit.app","password":"Demo@123"}' \
  | jq -r '.access_token')

# Create a trip
curl -X POST $BASE/api/trips \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Goa Vibes","destinations":["Anjuna"],"start_date":"2026-05-01","end_date":"2026-05-05","currency":"INR","member_names":["Riya","Arjun"]}'

# AI budget
curl -X POST $BASE/api/ai/budget-estimate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"destinations":["Goa"],"days":4,"people":3,"currency":"INR","travel_style":"mid-range"}'
```

---

## 🗺 Roadmap

See [`TRIPSPLIT_ROADMAP.md`](./TRIPSPLIT_ROADMAP.md) for 10-day sprint plan + team task split.

---

## 📈 Test coverage

Backend: **28/28 pytest cases pass** (100%).
Frontend: tested manually on mobile viewport (430px).

---

## 👥 Team

- **You** — Team Lead / Full-stack
- **Eng A** — Backend-heavy
- **Eng B** — Frontend-heavy

---

*Built as an internship capstone project in a 10-day sprint. Powered by Emergent.*
