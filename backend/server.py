"""TripSplit backend — FastAPI + MongoDB + Gemini 3 Flash."""
from dotenv import load_dotenv
load_dotenv()

import os
import json
import uuid
import bcrypt
import jwt as pyjwt
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response, Depends, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from bson import ObjectId

# ---------------- Config ----------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "demo@tripsplit.app")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "Demo@123")
DEMO_NAME = os.environ.get("DEMO_NAME", "Demo Traveler")

# Country -> currency mapping (subset, expand as needed)
COUNTRY_CURRENCY = {
    "IN": {"name": "India", "currency": "INR", "symbol": "₹", "flag": "🇮🇳"},
    "US": {"name": "United States", "currency": "USD", "symbol": "$", "flag": "🇺🇸"},
    "GB": {"name": "United Kingdom", "currency": "GBP", "symbol": "£", "flag": "🇬🇧"},
    "EU": {"name": "Eurozone", "currency": "EUR", "symbol": "€", "flag": "🇪🇺"},
    "JP": {"name": "Japan", "currency": "JPY", "symbol": "¥", "flag": "🇯🇵"},
    "AU": {"name": "Australia", "currency": "AUD", "symbol": "A$", "flag": "🇦🇺"},
    "CA": {"name": "Canada", "currency": "CAD", "symbol": "C$", "flag": "🇨🇦"},
    "AE": {"name": "UAE", "currency": "AED", "symbol": "د.إ", "flag": "🇦🇪"},
    "SG": {"name": "Singapore", "currency": "SGD", "symbol": "S$", "flag": "🇸🇬"},
    "TH": {"name": "Thailand", "currency": "THB", "symbol": "฿", "flag": "🇹🇭"},
    "ID": {"name": "Indonesia", "currency": "IDR", "symbol": "Rp", "flag": "🇮🇩"},
    "MY": {"name": "Malaysia", "currency": "MYR", "symbol": "RM", "flag": "🇲🇾"},
    "FR": {"name": "France", "currency": "EUR", "symbol": "€", "flag": "🇫🇷"},
    "DE": {"name": "Germany", "currency": "EUR", "symbol": "€", "flag": "🇩🇪"},
    "CH": {"name": "Switzerland", "currency": "CHF", "symbol": "CHF", "flag": "🇨🇭"},
}

# Static FX rates (as of approx 2026 — used when no live source)
# base: USD = 1
USD_RATES = {
    "USD": 1.0, "INR": 84.5, "EUR": 0.92, "GBP": 0.79, "JPY": 155.0,
    "AUD": 1.55, "CAD": 1.38, "AED": 3.67, "SGD": 1.34, "THB": 34.5,
    "IDR": 15900.0, "MYR": 4.7, "CHF": 0.88,
}

def convert_currency(amount: float, from_cur: str, to_cur: str) -> float:
    if from_cur == to_cur:
        return round(amount, 2)
    if from_cur not in USD_RATES or to_cur not in USD_RATES:
        return round(amount, 2)
    usd_amt = amount / USD_RATES[from_cur]
    return round(usd_amt * USD_RATES[to_cur], 2)

# ---------------- DB ----------------
client: Optional[AsyncIOMotorClient] = None
db = None
gridfs_bucket: Optional[AsyncIOMotorGridFSBucket] = None

# ---------------- Password / JWT ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_jwt(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def decode_jwt(token: str) -> Optional[dict]:
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception:
        return None

# ---------------- Models ----------------
class UserPublic(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    home_country: Optional[str] = "IN"
    home_currency: Optional[str] = "INR"
    created_at: datetime

class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=1)
    home_country: Optional[str] = "IN"

class LoginBody(BaseModel):
    email: EmailStr
    password: str

class OTPLoginBody(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None
    home_country: Optional[str] = "IN"

class UpdateProfileBody(BaseModel):
    name: Optional[str] = None
    home_country: Optional[str] = None
    home_currency: Optional[str] = None

class TripMember(BaseModel):
    user_id: str
    name: str
    email: Optional[str] = None
    color: str

class TripCreateBody(BaseModel):
    name: str
    destinations: List[str] = Field(default_factory=list)
    start_date: str  # ISO date
    end_date: str
    currency: str = "INR"
    member_names: List[str] = Field(default_factory=list)  # extra member names
    cover_key: Optional[str] = None  # goa/manali/bali

class Trip(BaseModel):
    trip_id: str
    owner_id: str
    name: str
    destinations: List[str]
    start_date: str
    end_date: str
    currency: str
    members: List[TripMember]
    cover_key: Optional[str]
    created_at: datetime

class ExpenseCreateBody(BaseModel):
    name: str
    amount: float
    currency: str = "INR"
    category: str = "Other"
    paid_by: str  # member user_id
    split_among: List[str] = Field(default_factory=list)  # member user_ids
    place: Optional[str] = None
    paid_at: Optional[str] = None

class Expense(BaseModel):
    expense_id: str
    trip_id: str
    name: str
    amount: float
    currency: str
    amount_home: float  # converted to trip currency
    category: str
    paid_by: str
    split_among: List[str]
    place: Optional[str]
    paid_at: str
    created_at: datetime

class BudgetEstimateBody(BaseModel):
    destinations: List[str]
    days: int = Field(..., ge=1, le=60)
    people: int = Field(..., ge=1, le=30)
    currency: str = "INR"
    travel_style: Optional[str] = "mid-range"  # budget / mid-range / luxury

class CategorizeBody(BaseModel):
    name: str

class SmartNotifyBody(BaseModel):
    raw_text: str  # e.g. "Paid ₹850 to Swiggy via GPay"

class FunFactsQuery(BaseModel):
    destination: str

class SettleBody(BaseModel):
    from_user: str
    to_user: str
    amount: float

# ---------------- Auth helpers ----------------
async def get_current_user(request: Request) -> dict:
    token = None
    # Prefer Authorization: Bearer <JWT>
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]

    if token:
        payload = decode_jwt(token)
        if payload and payload.get("sub"):
            user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
            if user:
                return user

    # Fallback: Emergent session_token (cookie OR header)
    session_token = request.cookies.get("session_token") or request.headers.get("X-Session-Token")
    if session_token:
        session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session_doc:
            expires_at = session_doc.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at and (expires_at.tzinfo is None):
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at and expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user
    raise HTTPException(status_code=401, detail="Not authenticated")

def _make_user_id() -> str:
    return f"user_{uuid.uuid4().hex[:12]}"

def _palette() -> List[str]:
    return ["#1A3626", "#D85C40", "#C29329", "#4A6273", "#89A78B", "#E3B992", "#B87A71", "#3B4C30"]

def _country_info(code: str) -> dict:
    return COUNTRY_CURRENCY.get(code.upper(), COUNTRY_CURRENCY["IN"])

async def seed_demo():
    """Idempotent demo user + sample trip seed."""
    existing = await db.users.find_one({"email": DEMO_EMAIL.lower()})
    if not existing:
        user_id = _make_user_id()
        await db.users.insert_one({
            "user_id": user_id,
            "email": DEMO_EMAIL.lower(),
            "name": DEMO_NAME,
            "password_hash": hash_password(DEMO_PASSWORD),
            "picture": None,
            "home_country": "IN",
            "home_currency": "INR",
            "created_at": datetime.now(timezone.utc),
        })
    else:
        # Ensure password matches env (idempotent update)
        if not verify_password(DEMO_PASSWORD, existing.get("password_hash", "")):
            await db.users.update_one(
                {"email": DEMO_EMAIL.lower()},
                {"$set": {"password_hash": hash_password(DEMO_PASSWORD)}},
            )

# ---------------- Lifespan ----------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global client, db, gridfs_bucket
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    gridfs_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="trip_docs")
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.trips.create_index("owner_id")
    await db.trips.create_index("trip_id", unique=True)
    await db.trips.create_index("invite_token", sparse=True)
    await db.expenses.create_index("trip_id")
    await db.trip_docs_meta.create_index("trip_id")
    await db.user_sessions.create_index("session_token", unique=True)
    await seed_demo()
    # Backfill invite tokens for existing trips (idempotent)
    async for t in db.trips.find({"$or": [{"invite_token": {"$exists": False}}, {"invite_token": None}]}, {"trip_id": 1}):
        await db.trips.update_one(
            {"trip_id": t["trip_id"]},
            {"$set": {"invite_token": uuid.uuid4().hex[:20]}},
        )
    yield
    client.close()

app = FastAPI(title="TripSplit API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Auth routes ----------------
@app.post("/api/auth/register")
async def register(body: RegisterBody):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = _make_user_id()
    country = _country_info(body.home_country or "IN")
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": body.name,
        "password_hash": hash_password(body.password),
        "picture": None,
        "home_country": body.home_country or "IN",
        "home_currency": country["currency"],
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_doc)
    token = create_jwt(user_id, email)
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return {"access_token": token, "token_type": "bearer", "user": user_doc}

@app.post("/api/auth/login")
async def login(body: LoginBody):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    # Brute force check
    identifier = f"login:{email}"
    attempts_doc = await db.login_attempts.find_one({"identifier": identifier})
    if attempts_doc:
        locked_until = attempts_doc.get("locked_until")
        if locked_until:
            if isinstance(locked_until, str):
                locked_until = datetime.fromisoformat(locked_until)
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=timezone.utc)
            if locked_until > datetime.now(timezone.utc):
                raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")
    if not verify_password(body.password, user["password_hash"]):
        # Increment
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$setOnInsert": {"identifier": identifier}},
            upsert=True,
        )
        new_doc = await db.login_attempts.find_one({"identifier": identifier})
        if new_doc and new_doc.get("count", 0) >= 5:
            await db.login_attempts.update_one(
                {"identifier": identifier},
                {"$set": {"locked_until": datetime.now(timezone.utc) + timedelta(minutes=15), "count": 0}},
            )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_one({"identifier": identifier})
    token = create_jwt(user["user_id"], email)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.post("/api/auth/otp")
async def login_otp(body: OTPLoginBody):
    """Prototype OTP login. Accepts any phone + hardcoded OTP '123456'."""
    if body.otp != "123456":
        raise HTTPException(status_code=401, detail="Invalid OTP. Use 123456 for prototype.")
    phone_key = body.phone.strip()
    pseudo_email = f"otp_{phone_key.replace('+','').replace(' ','')}@tripsplit.local"
    user = await db.users.find_one({"email": pseudo_email})
    if not user:
        user_id = _make_user_id()
        country = _country_info(body.home_country or "IN")
        user_doc = {
            "user_id": user_id,
            "email": pseudo_email,
            "name": body.name or f"Traveler {phone_key[-4:]}",
            "password_hash": None,
            "picture": None,
            "phone": phone_key,
            "home_country": body.home_country or "IN",
            "home_currency": country["currency"],
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user_doc)
        user = user_doc
    token = create_jwt(user["user_id"], user["email"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.post("/api/auth/google/session")
async def google_session(request: Request):
    """Process Emergent-managed Google session_id from frontend URL fragment."""
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    async with httpx.AsyncClient(timeout=15.0) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google session")
        data = r.json()
    email = (data.get("email") or "").lower()
    name = data.get("name") or "Traveler"
    picture = data.get("picture")
    session_token = data.get("session_token")
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = _make_user_id()
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "password_hash": None,
            "picture": picture,
            "home_country": "IN",
            "home_currency": "INR",
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user_doc)
        user = user_doc
    else:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"picture": picture or user.get("picture"), "name": user.get("name") or name}},
        )
    # Store session
    if session_token:
        await db.user_sessions.update_one(
            {"session_token": session_token},
            {"$set": {
                "session_token": session_token,
                "user_id": user["user_id"],
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                "created_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )
    jwt_token = create_jwt(user["user_id"], email)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "session_token": session_token,
        "user": user,
    }

@app.get("/api/auth/me")
async def me(current=Depends(get_current_user)):
    current.pop("password_hash", None)
    current.pop("_id", None)
    return current

@app.patch("/api/auth/me")
async def update_me(body: UpdateProfileBody, current=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if body.home_country and not body.home_currency:
        updates["home_currency"] = _country_info(body.home_country)["currency"]
    if updates:
        await db.users.update_one({"user_id": current["user_id"]}, {"$set": updates})
    user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0, "password_hash": 0})
    return user

@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token") or request.headers.get("X-Session-Token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

# ---------------- Countries & FX ----------------
@app.get("/api/countries")
async def countries():
    return [{"code": k, **v} for k, v in COUNTRY_CURRENCY.items()]

@app.get("/api/fx/{from_cur}/{to_cur}")
async def fx(from_cur: str, to_cur: str, amount: float = 1.0):
    converted = convert_currency(amount, from_cur.upper(), to_cur.upper())
    return {"from": from_cur.upper(), "to": to_cur.upper(), "amount": amount, "converted": converted}

# ---------------- Trips ----------------
@app.post("/api/trips")
async def create_trip(body: TripCreateBody, current=Depends(get_current_user)):
    trip_id = f"trip_{uuid.uuid4().hex[:12]}"
    palette = _palette()
    members: List[dict] = [{
        "user_id": current["user_id"],
        "name": current["name"],
        "email": current["email"],
        "color": palette[0],
    }]
    seen_names = {current["name"].lower()}
    idx = 1
    for m in body.member_names:
        if m.strip().lower() in seen_names:
            continue
        seen_names.add(m.strip().lower())
        members.append({
            "user_id": f"mem_{uuid.uuid4().hex[:10]}",
            "name": m.strip(),
            "email": None,
            "color": palette[idx % len(palette)],
        })
        idx += 1
    trip_doc = {
        "trip_id": trip_id,
        "owner_id": current["user_id"],
        "name": body.name,
        "destinations": body.destinations,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "currency": body.currency.upper(),
        "members": members,
        "cover_key": body.cover_key,
        "invite_token": uuid.uuid4().hex[:20],
        "created_at": datetime.now(timezone.utc),
    }
    await db.trips.insert_one(trip_doc)
    trip_doc.pop("_id", None)
    return trip_doc

@app.get("/api/trips")
async def list_trips(current=Depends(get_current_user)):
    cursor = db.trips.find(
        {"$or": [{"owner_id": current["user_id"]}, {"members.user_id": current["user_id"]}]},
        {"_id": 0},
    ).sort("created_at", -1)
    trips = await cursor.to_list(length=200)
    # Attach totals
    for t in trips:
        exp_cursor = db.expenses.find({"trip_id": t["trip_id"]}, {"_id": 0})
        exps = await exp_cursor.to_list(length=1000)
        t["total_spent"] = round(sum(e["amount_home"] for e in exps), 2)
        t["expense_count"] = len(exps)
    return trips

@app.get("/api/trips/{trip_id}")
async def get_trip(trip_id: str, current=Depends(get_current_user)):
    trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    # Authorization: owner or member
    member_ids = [m["user_id"] for m in trip["members"]]
    if current["user_id"] not in member_ids and current["user_id"] != trip["owner_id"]:
        raise HTTPException(status_code=403, detail="Not a trip member")
    exps = await db.expenses.find({"trip_id": trip_id}, {"_id": 0}).sort("paid_at", -1).to_list(length=1000)
    total = round(sum(e["amount_home"] for e in exps), 2)
    # Per-member spent (paid by)
    per_member_paid = {m["user_id"]: 0.0 for m in trip["members"]}
    per_member_share = {m["user_id"]: 0.0 for m in trip["members"]}
    per_category = {}
    for e in exps:
        per_member_paid[e["paid_by"]] = per_member_paid.get(e["paid_by"], 0.0) + e["amount_home"]
        split_ids = e["split_among"] or [m["user_id"] for m in trip["members"]]
        share = e["amount_home"] / max(len(split_ids), 1)
        for sid in split_ids:
            per_member_share[sid] = per_member_share.get(sid, 0.0) + share
        per_category[e["category"]] = per_category.get(e["category"], 0.0) + e["amount_home"]
    # Balances: positive = they are owed, negative = they owe
    balances = []
    for m in trip["members"]:
        paid = round(per_member_paid.get(m["user_id"], 0.0), 2)
        share = round(per_member_share.get(m["user_id"], 0.0), 2)
        balances.append({
            "user_id": m["user_id"],
            "name": m["name"],
            "color": m["color"],
            "paid": paid,
            "share": share,
            "net": round(paid - share, 2),
        })
    trip["expenses"] = exps
    trip["total_spent"] = total
    trip["per_member_paid"] = [
        {"user_id": m["user_id"], "name": m["name"], "color": m["color"], "amount": round(per_member_paid.get(m["user_id"], 0.0), 2)}
        for m in trip["members"]
    ]
    trip["per_category"] = [{"category": c, "amount": round(v, 2)} for c, v in per_category.items()]
    trip["balances"] = balances
    return trip

@app.post("/api/trips/{trip_id}/members")
async def add_member(trip_id: str, body: dict, current=Depends(get_current_user)):
    trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip["owner_id"] != current["user_id"]:
        raise HTTPException(status_code=403, detail="Only owner can add members")
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
    palette = _palette()
    new_member = {
        "user_id": f"mem_{uuid.uuid4().hex[:10]}",
        "name": name,
        "email": body.get("email"),
        "color": palette[len(trip["members"]) % len(palette)],
    }
    await db.trips.update_one({"trip_id": trip_id}, {"$push": {"members": new_member}})
    return new_member

# ---------------- Expenses ----------------
@app.post("/api/trips/{trip_id}/expenses")
async def add_expense(trip_id: str, body: ExpenseCreateBody, current=Depends(get_current_user)):
    trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    member_ids = [m["user_id"] for m in trip["members"]]
    if body.paid_by not in member_ids:
        raise HTTPException(status_code=400, detail="Payer not in trip")
    split = body.split_among or member_ids
    for s in split:
        if s not in member_ids:
            raise HTTPException(status_code=400, detail="Split member not in trip")
    currency = body.currency.upper()
    trip_currency = trip["currency"]
    amount_home = convert_currency(body.amount, currency, trip_currency)
    exp_doc = {
        "expense_id": f"exp_{uuid.uuid4().hex[:12]}",
        "trip_id": trip_id,
        "name": body.name,
        "amount": round(body.amount, 2),
        "currency": currency,
        "amount_home": amount_home,
        "category": body.category,
        "paid_by": body.paid_by,
        "split_among": split,
        "place": body.place,
        "paid_at": body.paid_at or datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc),
    }
    await db.expenses.insert_one(exp_doc)
    exp_doc.pop("_id", None)
    return exp_doc

@app.delete("/api/trips/{trip_id}/expenses/{expense_id}")
async def delete_expense(trip_id: str, expense_id: str, current=Depends(get_current_user)):
    trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    member_ids = [m["user_id"] for m in trip["members"]]
    if current["user_id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Forbidden")
    result = await db.expenses.delete_one({"trip_id": trip_id, "expense_id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"ok": True}

# ---------------- Settlement ----------------
def simplify_debts(balances: List[dict]) -> List[dict]:
    """Greedy: match largest creditor to largest debtor."""
    creditors = sorted([{"user_id": b["user_id"], "name": b["name"], "amt": b["net"]} for b in balances if b["net"] > 0.01], key=lambda x: -x["amt"])
    debtors = sorted([{"user_id": b["user_id"], "name": b["name"], "amt": -b["net"]} for b in balances if b["net"] < -0.01], key=lambda x: -x["amt"])
    txns = []
    i = j = 0
    while i < len(debtors) and j < len(creditors):
        pay = round(min(debtors[i]["amt"], creditors[j]["amt"]), 2)
        if pay <= 0:
            break
        txns.append({
            "from_user_id": debtors[i]["user_id"],
            "from_name": debtors[i]["name"],
            "to_user_id": creditors[j]["user_id"],
            "to_name": creditors[j]["name"],
            "amount": pay,
        })
        debtors[i]["amt"] = round(debtors[i]["amt"] - pay, 2)
        creditors[j]["amt"] = round(creditors[j]["amt"] - pay, 2)
        if debtors[i]["amt"] <= 0.01:
            i += 1
        if creditors[j]["amt"] <= 0.01:
            j += 1
    return txns

@app.get("/api/trips/{trip_id}/settlement")
async def settlement(trip_id: str, current=Depends(get_current_user)):
    trip = await get_trip(trip_id, current)
    simplified = simplify_debts(trip["balances"])
    return {"trip_id": trip_id, "currency": trip["currency"], "transactions": simplified, "balances": trip["balances"]}

@app.post("/api/trips/{trip_id}/settle")
async def settle(trip_id: str, body: SettleBody, current=Depends(get_current_user)):
    trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    member_ids = [m["user_id"] for m in trip["members"]]
    if body.from_user not in member_ids or body.to_user not in member_ids:
        raise HTTPException(status_code=400, detail="from_user and to_user must be trip members")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    # Record as a settlement expense: paid_by = from, split_among = [to] with negative net effect.
    # Simpler: add a synthetic expense where 'from' paid 'amount' to 'to' only.
    exp_doc = {
        "expense_id": f"set_{uuid.uuid4().hex[:12]}",
        "trip_id": trip_id,
        "name": "Settlement",
        "amount": body.amount,
        "currency": trip["currency"],
        "amount_home": body.amount,
        "category": "Settlement",
        "paid_by": body.from_user,
        "split_among": [body.to_user],
        "place": None,
        "paid_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc),
    }
    await db.expenses.insert_one(exp_doc)
    exp_doc.pop("_id", None)
    return exp_doc


# ---------------- Invite Links ----------------
@app.get("/api/trips/{trip_id}/invite")
async def get_invite(trip_id: str, current=Depends(get_current_user)):
    trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    member_ids = [m["user_id"] for m in trip["members"]]
    if current["user_id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Only members can share invite links")
    token = trip.get("invite_token")
    if not token:
        token = uuid.uuid4().hex[:20]
        await db.trips.update_one({"trip_id": trip_id}, {"$set": {"invite_token": token}})
    return {"trip_id": trip_id, "invite_token": token, "trip_name": trip["name"]}

@app.post("/api/trips/{trip_id}/invite/rotate")
async def rotate_invite(trip_id: str, current=Depends(get_current_user)):
    trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if current["user_id"] != trip["owner_id"]:
        raise HTTPException(status_code=403, detail="Only the owner can rotate invite links")
    token = uuid.uuid4().hex[:20]
    await db.trips.update_one({"trip_id": trip_id}, {"$set": {"invite_token": token}})
    return {"trip_id": trip_id, "invite_token": token}

@app.get("/api/invite/{token}/preview")
async def preview_invite(token: str):
    """Public preview — name + member count + destinations so user can see what they're joining."""
    trip = await db.trips.find_one({"invite_token": token}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Invalid invite link")
    return {
        "trip_id": trip["trip_id"],
        "name": trip["name"],
        "destinations": trip.get("destinations", []),
        "cover_key": trip.get("cover_key"),
        "start_date": trip.get("start_date"),
        "end_date": trip.get("end_date"),
        "members_count": len(trip.get("members", [])),
        "currency": trip.get("currency", "INR"),
    }

@app.post("/api/invite/{token}/accept")
async def accept_invite(token: str, current=Depends(get_current_user)):
    trip = await db.trips.find_one({"invite_token": token}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Invalid invite link")
    # Already a member? Short-circuit.
    existing = next((m for m in trip["members"] if m.get("user_id") == current["user_id"]
                     or (m.get("email") and m["email"] == current["email"])), None)
    if existing:
        # Attach user_id if matched by email only
        if existing.get("email") == current["email"] and existing["user_id"] != current["user_id"]:
            await db.trips.update_one(
                {"trip_id": trip["trip_id"], "members.email": current["email"]},
                {"$set": {"members.$.user_id": current["user_id"], "members.$.name": current["name"]}},
            )
        return {"trip_id": trip["trip_id"], "status": "already_member"}
    palette = _palette()
    new_member = {
        "user_id": current["user_id"],
        "name": current["name"],
        "email": current["email"],
        "color": palette[len(trip["members"]) % len(palette)],
    }
    await db.trips.update_one({"trip_id": trip["trip_id"]}, {"$push": {"members": new_member}})
    return {"trip_id": trip["trip_id"], "status": "joined", "member": new_member}

# ---------------- Trip Docs (GridFS) ----------------
ALLOWED_DOC_TYPES = {
    "application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp",
    "image/heic", "image/heif", "image/gif",
}
MAX_DOC_SIZE = 10 * 1024 * 1024  # 10 MB

@app.post("/api/trips/{trip_id}/docs")
async def upload_doc(trip_id: str, file: UploadFile = File(...), current=Depends(get_current_user)):
    trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    member_ids = [m["user_id"] for m in trip["members"]]
    if current["user_id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Only trip members can upload")
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported type: {content_type}. Allowed: PDF, PNG, JPG, WEBP, HEIC, GIF.")
    data = await file.read()
    if len(data) > MAX_DOC_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    gridfs_id = await gridfs_bucket.upload_from_stream(
        file.filename or "document",
        data,
        metadata={"trip_id": trip_id, "uploaded_by": current["user_id"], "content_type": content_type},
    )
    doc_id = f"doc_{uuid.uuid4().hex[:12]}"
    meta = {
        "doc_id": doc_id,
        "trip_id": trip_id,
        "gridfs_id": str(gridfs_id),
        "filename": file.filename or "document",
        "content_type": content_type,
        "size": len(data),
        "uploaded_by": current["user_id"],
        "uploaded_by_name": current["name"],
        "created_at": datetime.now(timezone.utc),
    }
    await db.trip_docs_meta.insert_one(meta)
    meta.pop("_id", None)
    return meta

@app.get("/api/trips/{trip_id}/docs")
async def list_docs(trip_id: str, current=Depends(get_current_user)):
    trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    member_ids = [m["user_id"] for m in trip["members"]]
    if current["user_id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Forbidden")
    docs = await db.trip_docs_meta.find({"trip_id": trip_id}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return docs

@app.get("/api/trips/{trip_id}/docs/{doc_id}")
async def download_doc(trip_id: str, doc_id: str, request: Request):
    # Auth: support either Bearer token OR ?token=... query for img/embed tags that cannot send headers
    token_q = request.query_params.get("token")
    if token_q and "Authorization" not in request.headers:
        payload = decode_jwt(token_q)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
    else:
        user = await get_current_user(request)
    trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    member_ids = [m["user_id"] for m in trip["members"]]
    if user["user_id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Forbidden")
    meta = await db.trip_docs_meta.find_one({"trip_id": trip_id, "doc_id": doc_id}, {"_id": 0})
    if not meta:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        grid_out = await gridfs_bucket.open_download_stream(ObjectId(meta["gridfs_id"]))
    except Exception:
        raise HTTPException(status_code=404, detail="File missing in storage")

    async def _stream():
        while True:
            chunk = await grid_out.readchunk()
            if not chunk:
                break
            yield chunk

    headers = {
        "Content-Disposition": f'inline; filename="{meta["filename"]}"',
        "Content-Length": str(meta["size"]),
        "Cache-Control": "private, max-age=3600",
    }
    return StreamingResponse(_stream(), media_type=meta["content_type"], headers=headers)

@app.delete("/api/trips/{trip_id}/docs/{doc_id}")
async def delete_doc(trip_id: str, doc_id: str, current=Depends(get_current_user)):
    trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    meta = await db.trip_docs_meta.find_one({"trip_id": trip_id, "doc_id": doc_id}, {"_id": 0})
    if not meta:
        raise HTTPException(status_code=404, detail="Document not found")
    # Owner of trip OR uploader can delete
    if current["user_id"] != trip["owner_id"] and current["user_id"] != meta["uploaded_by"]:
        raise HTTPException(status_code=403, detail="Only trip owner or uploader can delete")
    try:
        await gridfs_bucket.delete(ObjectId(meta["gridfs_id"]))
    except Exception:
        pass
    await db.trip_docs_meta.delete_one({"doc_id": doc_id})
    return {"ok": True}


# ---------------- AI ----------------
async def _gemini_json(system_msg: str, user_msg: str, session_id: str) -> dict:
    """Call Gemini 3 Flash and parse JSON from its response."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_msg,
    ).with_model("gemini", "gemini-3-flash-preview")
    resp = await chat.send_message(UserMessage(text=user_msg))
    text = resp if isinstance(resp, str) else str(resp)
    # Extract JSON block
    text = text.strip()
    if text.startswith("```"):
        # strip ``` fences
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    # Find first { or [
    start_brace = text.find("{")
    start_bracket = text.find("[")
    if start_brace == -1 and start_bracket == -1:
        raise ValueError("No JSON in response: " + text[:200])
    if start_brace != -1 and (start_bracket == -1 or start_brace < start_bracket):
        start = start_brace; end_ch = "}"
    else:
        start = start_bracket; end_ch = "]"
    end = text.rfind(end_ch)
    if end == -1 or end < start:
        raise ValueError("Malformed JSON: " + text[:200])
    return json.loads(text[start:end+1])

@app.post("/api/ai/budget-estimate")
async def ai_budget(body: BudgetEstimateBody, current=Depends(get_current_user)):
    sys = (
        "You are an expert travel budget planner. Given destinations, days, people, and travel_style, "
        "return a realistic budget breakdown across 4 categories: Stay, Food, Travel, Activities. "
        "Return STRICT JSON only with keys: stay, food, travel, activities, total, currency, "
        "tips (array of 3 short strings), style. Amounts must be integers in the requested currency "
        "for the WHOLE group (not per person). No markdown, no prose — only JSON."
    )
    user_msg = (
        f"Destinations: {', '.join(body.destinations) or 'Unknown'}\n"
        f"Days: {body.days}\n"
        f"People: {body.people}\n"
        f"Currency: {body.currency}\n"
        f"Travel style: {body.travel_style}\n"
        "Return JSON."
    )
    try:
        data = await _gemini_json(sys, user_msg, f"budget-{current['user_id']}-{datetime.now().timestamp()}")
    except Exception as e:
        # Fallback heuristic
        per_person_per_day = {"budget": 1500, "mid-range": 3500, "luxury": 8000}.get((body.travel_style or "mid-range").lower(), 3500)
        total = per_person_per_day * body.days * body.people
        data = {
            "stay": int(total * 0.4),
            "food": int(total * 0.25),
            "travel": int(total * 0.2),
            "activities": int(total * 0.15),
            "total": total,
            "currency": body.currency,
            "tips": ["Book stays early for better rates", "Mix street food with restaurant meals", "Use local transport for short distances"],
            "style": body.travel_style or "mid-range",
            "fallback": True,
        }
    # Ensure total
    if "total" not in data or not data["total"]:
        data["total"] = int(sum(data.get(k, 0) for k in ("stay", "food", "travel", "activities")))
    data["currency"] = data.get("currency") or body.currency
    return data

@app.post("/api/ai/categorize")
async def ai_categorize(body: CategorizeBody, current=Depends(get_current_user)):
    sys = (
        "You classify a travel expense into ONE category from this list exactly: "
        "Food, Stay, Travel, Activities, Shopping, Other. "
        "Return STRICT JSON: {\"category\": \"...\", \"confidence\": 0.0-1.0, \"emoji\": \"emoji\"}. No prose."
    )
    try:
        data = await _gemini_json(sys, f"Expense: {body.name}\nReturn JSON.", f"cat-{current['user_id']}-{datetime.now().timestamp()}")
    except Exception:
        name_l = body.name.lower()
        if any(w in name_l for w in ["swiggy", "zomato", "restaurant", "food", "breakfast", "lunch", "dinner", "cafe", "coffee", "pizza", "burger"]):
            data = {"category": "Food", "confidence": 0.8, "emoji": "🍽"}
        elif any(w in name_l for w in ["hotel", "stay", "airbnb", "resort", "hostel", "bnb"]):
            data = {"category": "Stay", "confidence": 0.85, "emoji": "🏨"}
        elif any(w in name_l for w in ["uber", "ola", "taxi", "flight", "train", "bus", "cab", "petrol", "fuel"]):
            data = {"category": "Travel", "confidence": 0.85, "emoji": "🚕"}
        elif any(w in name_l for w in ["ticket", "entry", "museum", "park", "adventure", "scuba", "trek"]):
            data = {"category": "Activities", "confidence": 0.8, "emoji": "🎟"}
        elif any(w in name_l for w in ["shop", "store", "mall", "souvenir", "clothes"]):
            data = {"category": "Shopping", "confidence": 0.8, "emoji": "🛍"}
        else:
            data = {"category": "Other", "confidence": 0.4, "emoji": "📝"}
    if data.get("category") not in ["Food", "Stay", "Travel", "Activities", "Shopping", "Other"]:
        data["category"] = "Other"
    return data

@app.post("/api/ai/smart-notify")
async def ai_smart_notify(body: SmartNotifyBody, current=Depends(get_current_user)):
    sys = (
        "You parse a short UPI / payment transaction description and extract structured data. "
        "Return STRICT JSON with keys: amount (number), currency (string, default INR), "
        "merchant (string, cleaned), category (one of Food, Stay, Travel, Activities, Shopping, Other), "
        "suggested_message (string starting with 'Looks like'), emoji. No prose."
    )
    try:
        data = await _gemini_json(sys, f"Transaction: {body.raw_text}\nReturn JSON.", f"upi-{current['user_id']}-{datetime.now().timestamp()}")
    except Exception:
        import re
        m = re.search(r"([₹$€£])?\s*(\d+[.,]?\d*)", body.raw_text)
        amt = float(m.group(2).replace(",", "")) if m else 0.0
        sym = m.group(1) if m else "₹"
        cur = {"₹": "INR", "$": "USD", "€": "EUR", "£": "GBP"}.get(sym or "₹", "INR")
        merchant = "Unknown"
        for keyword in ["Swiggy", "Zomato", "Uber", "Ola", "Starbucks", "Amazon", "BigBasket", "Airbnb"]:
            if keyword.lower() in body.raw_text.lower():
                merchant = keyword; break
        data = {
            "amount": amt, "currency": cur, "merchant": merchant,
            "category": "Food" if merchant in ["Swiggy", "Zomato", "Starbucks"] else ("Travel" if merchant in ["Uber", "Ola"] else "Other"),
            "suggested_message": f"Looks like {sym}{amt:g} at {merchant} — add to expenses?",
            "emoji": "✨",
        }
    if data.get("category") not in ["Food", "Stay", "Travel", "Activities", "Shopping", "Other"]:
        data["category"] = "Other"
    return data

@app.get("/api/ai/fun-facts")
async def ai_fun_facts(destination: str, current=Depends(get_current_user)):
    # Caching by destination (simple)
    cached = await db.ai_cache.find_one({"kind": "funfacts", "key": destination.lower()}, {"_id": 0})
    if cached:
        return cached["data"]
    sys = (
        "You are a travel storyteller. Return 6 short, surprising fun facts about the destination. "
        "Each fact: 1-2 sentences, intriguing, no clichés. "
        "Return STRICT JSON: {\"destination\": \"...\", \"facts\": [{\"emoji\": \"\", \"title\": \"short headline\", \"text\": \"the fact\"}, ...]}."
    )
    try:
        data = await _gemini_json(sys, f"Destination: {destination}\nReturn JSON with 6 facts.", f"facts-{destination}-{datetime.now().timestamp()}")
    except Exception:
        data = {
            "destination": destination,
            "facts": [
                {"emoji": "🌍", "title": "Hidden gem", "text": f"{destination} has secrets waiting beyond the usual tourist trail."},
                {"emoji": "🍽️", "title": "Food culture", "text": f"Local food in {destination} is best eaten where the locals line up."},
                {"emoji": "🗺️", "title": "Getting around", "text": f"Public transport in {destination} is often the fastest way to see everything."},
                {"emoji": "🎭", "title": "Festivals", "text": f"{destination} celebrates unique festivals that tell stories centuries old."},
                {"emoji": "💰", "title": "Money tip", "text": f"Carry small cash for {destination}'s street stalls — many don't take cards."},
                {"emoji": "📸", "title": "Photo spot", "text": f"Golden hour in {destination} rewards early risers with the best shots."},
            ],
            "fallback": True,
        }
    try:
        await db.ai_cache.update_one(
            {"kind": "funfacts", "key": destination.lower()},
            {"$set": {"kind": "funfacts", "key": destination.lower(), "data": data, "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
    except Exception:
        pass
    return data

# ---------------- Health ----------------
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "tripsplit", "time": datetime.now(timezone.utc).isoformat()}

@app.get("/api/")
async def root():
    return {"service": "TripSplit API", "version": "1.0"}
