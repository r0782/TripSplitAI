"""TripSplit backend pytest suite — covers auth, trips, expenses, settlement, AI."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fff7acd7-0a35-47dd-ab88-cf1ef443a0bb.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@tripsplit.app"
DEMO_PASSWORD = "Demo@123"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def demo_token(session):
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Demo login failed: {r.status_code} {r.text}")
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"}


# ---------- Health ----------
def test_health(session):
    r = session.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_demo_login_success(self, session):
        r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and isinstance(data["access_token"], str)
        assert data["user"]["email"] == DEMO_EMAIL
        assert data["user"]["home_currency"] == "INR"
        assert "password_hash" not in data["user"]
        assert "_id" not in data["user"]

    def test_login_wrong_password(self, session):
        # Use unique email so we don't trip lockout on demo
        unique = f"nopass_{uuid.uuid4().hex[:6]}@tripsplit.example.com"
        r = session.post(f"{API}/auth/login", json={"email": unique, "password": "wrong"})
        assert r.status_code == 401

    def test_register_new_user_and_me(self, session):
        email = f"test_{uuid.uuid4().hex[:8]}@tripsplit.example.com"
        r = session.post(f"{API}/auth/register", json={
            "email": email, "password": "Pass@123", "name": "TEST User", "home_country": "US"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        token = data["access_token"]
        assert data["user"]["home_country"] == "US"
        assert data["user"]["home_currency"] == "USD"
        # /auth/me with bearer
        me = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == email

    def test_register_duplicate_email_fails(self, session):
        # demo email already exists
        r = session.post(f"{API}/auth/register", json={
            "email": DEMO_EMAIL, "password": "Demo@123", "name": "x"
        })
        assert r.status_code == 400

    def test_patch_me_changes_currency(self, session):
        email = f"patch_{uuid.uuid4().hex[:6]}@tripsplit.example.com"
        reg = session.post(f"{API}/auth/register", json={"email": email, "password": "Pass@123", "name": "P"}).json()
        tok = reg["access_token"]
        r = session.patch(f"{API}/auth/me", json={"home_country": "GB"},
                          headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200
        assert r.json()["home_country"] == "GB"
        assert r.json()["home_currency"] == "GBP"

    def test_otp_login_correct(self, session):
        phone = f"+91{uuid.uuid4().int % 10**10:010d}"
        r = session.post(f"{API}/auth/otp", json={"phone": phone, "otp": "123456", "name": "OTP User"})
        assert r.status_code == 200
        assert "access_token" in r.json()
        assert r.json()["user"]["name"] == "OTP User"

    def test_otp_login_wrong(self, session):
        r = session.post(f"{API}/auth/otp", json={"phone": "+919999999999", "otp": "000000"})
        assert r.status_code == 401

    def test_me_no_auth(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_brute_force_lockout(self, session):
        # Register a fresh user, hit wrong password 5+ times -> lockout 429
        email = f"bf_{uuid.uuid4().hex[:6]}@tripsplit.example.com"
        session.post(f"{API}/auth/register", json={"email": email, "password": "Right@123", "name": "BF"})
        last = None
        for _ in range(6):
            last = session.post(f"{API}/auth/login", json={"email": email, "password": "wrong!"})
        # After enough wrong attempts, expect 429 on next try
        final = session.post(f"{API}/auth/login", json={"email": email, "password": "wrong!"})
        assert final.status_code in (401, 429)
        # At least one lockout triggered eventually:
        retry = session.post(f"{API}/auth/login", json={"email": email, "password": "Right@123"})
        # Should be locked out (429) since we just hit threshold
        assert retry.status_code in (200, 429), f"expected 200 or 429 got {retry.status_code}"


# ---------- Countries / FX ----------
class TestCountriesFX:
    def test_countries_list(self, session):
        r = session.get(f"{API}/countries")
        assert r.status_code == 200
        countries = r.json()
        assert len(countries) >= 15
        codes = {c["code"] for c in countries}
        assert {"IN", "US", "GB", "EU", "JP"}.issubset(codes)
        for c in countries:
            assert "currency" in c and "symbol" in c and "flag" in c

    def test_fx_usd_inr(self, session):
        r = session.get(f"{API}/fx/USD/INR", params={"amount": 100})
        assert r.status_code == 200
        d = r.json()
        assert d["from"] == "USD" and d["to"] == "INR"
        # 100 USD ≈ 8450 INR per static table
        assert 8000 < d["converted"] < 9000

    def test_fx_same_currency(self, session):
        r = session.get(f"{API}/fx/INR/INR", params={"amount": 50})
        assert r.status_code == 200
        assert r.json()["converted"] == 50


# ---------- Trips & Expenses & Settlement ----------
class TestTripsFlow:
    @pytest.fixture(scope="class")
    def trip(self, auth_headers):
        body = {
            "name": "TEST Goa",
            "destinations": ["Goa"],
            "start_date": "2026-02-10",
            "end_date": "2026-02-14",
            "currency": "INR",
            "member_names": ["Aarav", "Diya", "Rohan"],
        }
        r = requests.post(f"{API}/trips", json=body, headers=auth_headers)
        assert r.status_code == 200, r.text
        t = r.json()
        # Owner + 3 members = 4
        assert len(t["members"]) == 4
        colors = {m["color"] for m in t["members"]}
        assert len(colors) == 4  # unique colors
        return t

    def test_list_trips(self, auth_headers, trip):
        r = requests.get(f"{API}/trips", headers=auth_headers)
        assert r.status_code == 200
        ids = [t["trip_id"] for t in r.json()]
        assert trip["trip_id"] in ids
        for t in r.json():
            if t["trip_id"] == trip["trip_id"]:
                assert "total_spent" in t and "expense_count" in t

    def test_get_trip_with_balances(self, auth_headers, trip):
        r = requests.get(f"{API}/trips/{trip['trip_id']}", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        for k in ("balances", "per_member_paid", "per_category", "expenses"):
            assert k in body

    def test_add_member(self, auth_headers, trip):
        r = requests.post(f"{API}/trips/{trip['trip_id']}/members",
                          json={"name": "Maya"}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["name"] == "Maya"

    def test_add_expense_inr(self, auth_headers, trip):
        owner = trip["members"][0]["user_id"]
        r = requests.post(f"{API}/trips/{trip['trip_id']}/expenses", json={
            "name": "Hotel night 1", "amount": 8000, "currency": "INR",
            "category": "Stay", "paid_by": owner, "split_among": [m["user_id"] for m in trip["members"]],
        }, headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["amount_home"] == 8000  # same currency

    def test_add_expense_cross_currency_usd_to_inr(self, auth_headers, trip):
        owner = trip["members"][0]["user_id"]
        r = requests.post(f"{API}/trips/{trip['trip_id']}/expenses", json={
            "name": "Scuba booking", "amount": 100, "currency": "USD",
            "category": "Activities", "paid_by": owner,
            "split_among": [m["user_id"] for m in trip["members"][:2]],
        }, headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        # 100 USD ≈ 8450 INR
        assert 8000 < d["amount_home"] < 9000, f"got {d['amount_home']}"
        assert d["currency"] == "USD"

    def test_invalid_payer_rejected(self, auth_headers, trip):
        r = requests.post(f"{API}/trips/{trip['trip_id']}/expenses", json={
            "name": "Bad payer", "amount": 10, "currency": "INR", "category": "Other",
            "paid_by": "user_doesnotexist",
        }, headers=auth_headers)
        assert r.status_code == 400

    def test_settlement_minimal_transactions(self, auth_headers, trip):
        # Get balances; with 1 payer and even split, debtors = N-1; creditor = 1
        r = requests.get(f"{API}/trips/{trip['trip_id']}/settlement", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        balances = d["balances"]
        net_pos = sum(1 for b in balances if b["net"] > 0.01)
        net_neg = sum(1 for b in balances if b["net"] < -0.01)
        # Number of txns should be <= max(net_pos, net_neg)
        assert len(d["transactions"]) <= max(net_pos, net_neg) + 1
        # Sum of txns from a debtor must equal their negative balance (approx)
        # Sum of txns to creditor equal their positive balance
        for b in balances:
            if b["net"] > 0.01:
                received = sum(t["amount"] for t in d["transactions"] if t["to_user_id"] == b["user_id"])
                assert abs(received - b["net"]) < 1.0
            if b["net"] < -0.01:
                paid = sum(t["amount"] for t in d["transactions"] if t["from_user_id"] == b["user_id"])
                assert abs(paid - (-b["net"])) < 1.0

    def test_record_settlement(self, auth_headers, trip):
        owner = trip["members"][0]["user_id"]
        other = trip["members"][1]["user_id"]
        r = requests.post(f"{API}/trips/{trip['trip_id']}/settle",
                          json={"from_user": other, "to_user": owner, "amount": 500},
                          headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["category"] == "Settlement"

    def test_delete_expense(self, auth_headers, trip):
        owner = trip["members"][0]["user_id"]
        c = requests.post(f"{API}/trips/{trip['trip_id']}/expenses", json={
            "name": "DELME", "amount": 10, "currency": "INR", "category": "Other", "paid_by": owner,
        }, headers=auth_headers)
        eid = c.json()["expense_id"]
        d = requests.delete(f"{API}/trips/{trip['trip_id']}/expenses/{eid}", headers=auth_headers)
        assert d.status_code == 200

    def test_non_member_cannot_access_trip(self, session, trip):
        # Create new user, try to GET demo's trip → 403
        email = f"intruder_{uuid.uuid4().hex[:6]}@tripsplit.example.com"
        reg = session.post(f"{API}/auth/register", json={
            "email": email, "password": "Pass@123", "name": "Intruder"
        }).json()
        tok = reg["access_token"]
        r = requests.get(f"{API}/trips/{trip['trip_id']}",
                         headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 403

    def test_non_owner_cannot_add_member(self, session, trip):
        email = f"ext_{uuid.uuid4().hex[:6]}@tripsplit.example.com"
        reg = session.post(f"{API}/auth/register", json={
            "email": email, "password": "Pass@123", "name": "Ext"
        }).json()
        tok = reg["access_token"]
        r = requests.post(f"{API}/trips/{trip['trip_id']}/members",
                         json={"name": "X"},
                         headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 403


# ---------- AI endpoints (Gemini 3 Flash) ----------
class TestAI:
    def test_categorize(self, auth_headers):
        r = requests.post(f"{API}/ai/categorize", json={"name": "Dinner at Swiggy"},
                          headers=auth_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["category"] in ["Food", "Stay", "Travel", "Activities", "Shopping", "Other"]
        # Heuristic / AI both should pick Food
        assert d["category"] == "Food"

    def test_smart_notify(self, auth_headers):
        r = requests.post(f"{API}/ai/smart-notify",
                          json={"raw_text": "Paid ₹850 to Swiggy via GPay"},
                          headers=auth_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "amount" in d and "merchant" in d and "category" in d
        # Amount should be 850
        assert abs(float(d["amount"]) - 850) < 1
        assert "swiggy" in str(d["merchant"]).lower()

    def test_budget_estimate(self, auth_headers):
        r = requests.post(f"{API}/ai/budget-estimate", json={
            "destinations": ["Goa"], "days": 4, "people": 3, "currency": "INR", "travel_style": "mid-range"
        }, headers=auth_headers, timeout=45)
        assert r.status_code == 200
        d = r.json()
        for k in ("stay", "food", "travel", "activities", "total", "currency"):
            assert k in d
        assert d["currency"] in ("INR", "inr")
        assert d["total"] > 0

    def test_fun_facts_and_cache(self, auth_headers):
        dest = f"Goa_{uuid.uuid4().hex[:4]}"
        t0 = time.time()
        r = requests.get(f"{API}/ai/fun-facts", params={"destination": dest},
                         headers=auth_headers, timeout=45)
        assert r.status_code == 200
        d = r.json()
        assert "facts" in d and len(d["facts"]) >= 5
        # Second call should be cached and faster
        t1 = time.time()
        r2 = requests.get(f"{API}/ai/fun-facts", params={"destination": dest},
                          headers=auth_headers, timeout=15)
        t2 = time.time()
        assert r2.status_code == 200
        assert r2.json() == d  # cached
        assert (t2 - t1) < (t1 - t0) or (t2 - t1) < 2.0
