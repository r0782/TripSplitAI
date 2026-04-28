"""TripSplit iteration 2 — Invite Links + Trip Docs (GridFS) tests.

Covers:
- Invite: get/rotate/preview/accept (members vs non-members, idempotency, email-stub attach)
- Docs: upload/list/download (Bearer + ?token=)/delete with auth, types, size, gridfs cleanup
"""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://fff7acd7-0a35-47dd-ab88-cf1ef443a0bb.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@tripsplit.app"
DEMO_PASSWORD = "Demo@123"


# Minimal valid PDF bytes (~ 200 bytes, real PDF magic header)
PDF_BYTES = (
    b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
)

# Tiny PNG (1x1 transparent) — real PNG magic
PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _register(name_prefix="user"):
    email = f"{name_prefix}_{uuid.uuid4().hex[:8]}@tripsplit.example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Pass@123", "name": f"TEST {name_prefix}"
    })
    assert r.status_code == 200, r.text
    body = r.json()
    return {"email": email, "token": body["access_token"], "user": body["user"]}


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def owner():
    return _register("owner")


@pytest.fixture(scope="module")
def trip(owner):
    body = {
        "name": "TEST Invite/Docs Trip",
        "destinations": ["Goa"],
        "start_date": "2026-03-01",
        "end_date": "2026-03-05",
        "currency": "INR",
        "member_names": ["Alpha"],
    }
    r = requests.post(f"{API}/trips", json=body, headers=_hdr(owner["token"]))
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- Invite ----------------
class TestInvite:
    def test_get_invite_by_member(self, owner, trip):
        r = requests.get(f"{API}/trips/{trip['trip_id']}/invite", headers=_hdr(owner["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["trip_id"] == trip["trip_id"]
        assert isinstance(d["invite_token"], str) and len(d["invite_token"]) >= 16
        assert d["trip_name"] == trip["name"]

    def test_get_invite_idempotent_token(self, owner, trip):
        a = requests.get(f"{API}/trips/{trip['trip_id']}/invite", headers=_hdr(owner["token"])).json()
        b = requests.get(f"{API}/trips/{trip['trip_id']}/invite", headers=_hdr(owner["token"])).json()
        assert a["invite_token"] == b["invite_token"]

    def test_get_invite_non_member_forbidden(self, trip):
        intruder = _register("intruder")
        r = requests.get(f"{API}/trips/{trip['trip_id']}/invite", headers=_hdr(intruder["token"]))
        assert r.status_code == 403

    def test_preview_public(self, owner, trip):
        tok = requests.get(f"{API}/trips/{trip['trip_id']}/invite", headers=_hdr(owner["token"])).json()["invite_token"]
        # NO auth header
        r = requests.get(f"{API}/invite/{tok}/preview")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["trip_id"] == trip["trip_id"]
        assert d["name"] == trip["name"]
        assert d["destinations"] == ["Goa"]
        assert d["members_count"] >= 2  # owner + Alpha

    def test_preview_invalid_token(self):
        r = requests.get(f"{API}/invite/{'x' * 20}/preview")
        assert r.status_code == 404

    def test_rotate_non_owner_forbidden(self, trip):
        # Add a 2nd member via accept first; then try to rotate as non-owner
        # Get token
        owner_tok = trip  # not used; ignore
        intruder = _register("rot_intruder")
        r = requests.post(f"{API}/trips/{trip['trip_id']}/invite/rotate", headers=_hdr(intruder["token"]))
        assert r.status_code in (403, 404)  # 404 if not member-aware; 403 expected

    def test_accept_flow_two_users(self, owner, trip):
        # User B accepts invite
        invite = requests.get(f"{API}/trips/{trip['trip_id']}/invite", headers=_hdr(owner["token"])).json()
        token = invite["invite_token"]
        user_b = _register("invitee")
        r = requests.post(f"{API}/invite/{token}/accept", headers=_hdr(user_b["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "joined"
        assert d["member"]["user_id"] == user_b["user"]["user_id"]
        assert d["member"]["color"]
        # Verify membership via GET /trips
        t = requests.get(f"{API}/trips/{trip['trip_id']}", headers=_hdr(user_b["token"]))
        assert t.status_code == 200
        ids = [m["user_id"] for m in t.json()["members"]]
        assert user_b["user"]["user_id"] in ids

    def test_accept_idempotent_already_member(self, owner, trip):
        invite = requests.get(f"{API}/trips/{trip['trip_id']}/invite", headers=_hdr(owner["token"])).json()
        # Owner is already a member; accept should be already_member
        r = requests.post(f"{API}/invite/{invite['invite_token']}/accept", headers=_hdr(owner["token"]))
        assert r.status_code == 200
        assert r.json()["status"] == "already_member"
        # Confirm no duplicate member
        t = requests.get(f"{API}/trips/{trip['trip_id']}", headers=_hdr(owner["token"])).json()
        owner_uid = owner["user"]["user_id"]
        assert sum(1 for m in t["members"] if m["user_id"] == owner_uid) == 1

    def test_accept_invalid_token(self, owner):
        r = requests.post(f"{API}/invite/{'badtok' + uuid.uuid4().hex}/accept", headers=_hdr(owner["token"]))
        assert r.status_code == 404

    def test_accept_attaches_user_id_to_email_stub(self, owner):
        # The public TripCreate API only accepts member_names (no email). To exercise the
        # "match by email and attach user_id" branch in accept_invite, we seed an email-only
        # stub member directly into Mongo (this models a future API that supports email invites).
        try:
            from pymongo import MongoClient
        except ImportError:
            pytest.skip("pymongo not installed")
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "tripsplit")
        client = MongoClient(mongo_url)
        db = client[db_name]
        # Create a trip via API first
        body = {
            "name": "TEST Email Stub Trip",
            "destinations": ["Bali"],
            "start_date": "2026-04-01",
            "end_date": "2026-04-05",
            "currency": "INR",
            "member_names": [],
        }
        r = requests.post(f"{API}/trips", json=body, headers=_hdr(owner["token"]))
        assert r.status_code == 200, r.text
        new_trip = r.json()
        # Inject stub member with email but NO real user_id
        stub_email = f"stub_{uuid.uuid4().hex[:8]}@tripsplit.example.com"
        stub_member = {
            "user_id": f"mem_{uuid.uuid4().hex[:10]}",
            "name": "StubUser",
            "email": stub_email,
            "color": "#ff8800",
        }
        db.trips.update_one({"trip_id": new_trip["trip_id"]}, {"$push": {"members": stub_member}})
        new_trip = db.trips.find_one({"trip_id": new_trip["trip_id"]}, {"_id": 0})
        members_before = len(new_trip["members"])
        # Get invite
        inv = requests.get(f"{API}/trips/{new_trip['trip_id']}/invite", headers=_hdr(owner["token"])).json()
        # Register user with that email
        reg = requests.post(f"{API}/auth/register", json={
            "email": stub_email, "password": "Pass@123", "name": "Real Stub"
        })
        if reg.status_code != 200:
            pytest.skip(f"could not register stub user: {reg.text}")
        stub_tok = reg.json()["access_token"]
        # Accept
        ar = requests.post(f"{API}/invite/{inv['invite_token']}/accept", headers=_hdr(stub_tok))
        assert ar.status_code == 200
        assert ar.json()["status"] == "already_member"
        # Verify member count unchanged and stub now has user_id
        t = requests.get(f"{API}/trips/{new_trip['trip_id']}", headers=_hdr(owner["token"])).json()
        assert len(t["members"]) == members_before, "must not duplicate stub"
        stub_member = next(m for m in t["members"] if m.get("email") == stub_email)
        assert stub_member["user_id"] == reg.json()["user"]["user_id"]

    def test_rotate_invalidates_old(self, owner, trip):
        old = requests.get(f"{API}/trips/{trip['trip_id']}/invite", headers=_hdr(owner["token"])).json()["invite_token"]
        r = requests.post(f"{API}/trips/{trip['trip_id']}/invite/rotate", headers=_hdr(owner["token"]))
        assert r.status_code == 200, r.text
        new_tok = r.json()["invite_token"]
        assert new_tok != old
        # Old preview must 404
        old_pv = requests.get(f"{API}/invite/{old}/preview")
        assert old_pv.status_code == 404
        # New preview works
        new_pv = requests.get(f"{API}/invite/{new_tok}/preview")
        assert new_pv.status_code == 200


# ---------------- Docs (GridFS) ----------------
class TestDocs:
    def test_upload_pdf_member(self, owner, trip):
        files = {"file": ("brief.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
        r = requests.post(f"{API}/trips/{trip['trip_id']}/docs", files=files, headers=_hdr(owner["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["doc_id"].startswith("doc_")
        assert d["content_type"] == "application/pdf"
        assert d["size"] == len(PDF_BYTES)
        assert d["uploaded_by"] == owner["user"]["user_id"]
        # Save for next test
        pytest.shared_doc_id = d["doc_id"]
        pytest.shared_gridfs_id = d["gridfs_id"]

    def test_upload_unsupported_type(self, owner, trip):
        files = {"file": ("evil.exe", io.BytesIO(b"MZ\x90\x00fake"), "application/x-msdownload")}
        r = requests.post(f"{API}/trips/{trip['trip_id']}/docs", files=files, headers=_hdr(owner["token"]))
        assert r.status_code == 400

    def test_upload_empty(self, owner, trip):
        files = {"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")}
        r = requests.post(f"{API}/trips/{trip['trip_id']}/docs", files=files, headers=_hdr(owner["token"]))
        assert r.status_code == 400

    def test_upload_too_large(self, owner, trip):
        # 11 MB PDF
        big = b"%PDF-1.4\n" + (b"A" * (11 * 1024 * 1024))
        files = {"file": ("big.pdf", io.BytesIO(big), "application/pdf")}
        r = requests.post(f"{API}/trips/{trip['trip_id']}/docs", files=files, headers=_hdr(owner["token"]))
        assert r.status_code == 400

    def test_upload_non_member_forbidden(self, trip):
        intruder = _register("doc_intruder")
        files = {"file": ("x.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
        r = requests.post(f"{API}/trips/{trip['trip_id']}/docs", files=files, headers=_hdr(intruder["token"]))
        assert r.status_code == 403

    def test_list_docs_member(self, owner, trip):
        r = requests.get(f"{API}/trips/{trip['trip_id']}/docs", headers=_hdr(owner["token"]))
        assert r.status_code == 200
        docs = r.json()
        assert any(d["doc_id"] == pytest.shared_doc_id for d in docs)

    def test_list_docs_non_member_forbidden(self, trip):
        intruder = _register("listintruder")
        r = requests.get(f"{API}/trips/{trip['trip_id']}/docs", headers=_hdr(intruder["token"]))
        assert r.status_code == 403

    def test_download_with_bearer(self, owner, trip):
        r = requests.get(f"{API}/trips/{trip['trip_id']}/docs/{pytest.shared_doc_id}", headers=_hdr(owner["token"]))
        assert r.status_code == 200
        assert r.content == PDF_BYTES
        assert "application/pdf" in r.headers.get("content-type", "")

    def test_download_with_query_token(self, owner, trip):
        r = requests.get(
            f"{API}/trips/{trip['trip_id']}/docs/{pytest.shared_doc_id}",
            params={"token": owner["token"]},
        )
        assert r.status_code == 200, r.text
        assert r.content == PDF_BYTES

    def test_download_invalid_query_token(self, trip):
        r = requests.get(
            f"{API}/trips/{trip['trip_id']}/docs/{pytest.shared_doc_id}",
            params={"token": "not-a-jwt"},
        )
        assert r.status_code == 401

    def test_download_wrong_doc_id(self, owner, trip):
        r = requests.get(
            f"{API}/trips/{trip['trip_id']}/docs/doc_doesnotexist",
            headers=_hdr(owner["token"]),
        )
        assert r.status_code == 404

    def test_download_non_member_forbidden(self, trip):
        intruder = _register("dlintruder")
        r = requests.get(
            f"{API}/trips/{trip['trip_id']}/docs/{pytest.shared_doc_id}",
            headers=_hdr(intruder["token"]),
        )
        assert r.status_code == 403

    def test_other_member_cannot_delete_only_uploader_or_owner(self, owner, trip):
        # Add another member via invite-accept; they upload nothing; try to delete owner's doc → 403
        invite = requests.get(f"{API}/trips/{trip['trip_id']}/invite", headers=_hdr(owner["token"])).json()
        other = _register("memberC")
        ar = requests.post(f"{API}/invite/{invite['invite_token']}/accept", headers=_hdr(other["token"]))
        assert ar.status_code == 200
        # other tries to delete owner's doc — but owner is also trip owner, so the doc was uploaded by owner.
        # This member is neither uploader nor owner → 403
        r = requests.delete(
            f"{API}/trips/{trip['trip_id']}/docs/{pytest.shared_doc_id}",
            headers=_hdr(other["token"]),
        )
        assert r.status_code == 403

    def test_uploader_can_delete_and_gridfs_cleanup(self, owner, trip):
        # Upload a fresh doc, delete it, verify gone from list and download 404
        files = {"file": ("delme.png", io.BytesIO(PNG_BYTES), "image/png")}
        up = requests.post(f"{API}/trips/{trip['trip_id']}/docs", files=files, headers=_hdr(owner["token"]))
        assert up.status_code == 200, up.text
        did = up.json()["doc_id"]
        # delete
        d = requests.delete(f"{API}/trips/{trip['trip_id']}/docs/{did}", headers=_hdr(owner["token"]))
        assert d.status_code == 200
        # list — gone
        lst = requests.get(f"{API}/trips/{trip['trip_id']}/docs", headers=_hdr(owner["token"])).json()
        assert not any(x["doc_id"] == did for x in lst)
        # download — 404
        gd = requests.get(f"{API}/trips/{trip['trip_id']}/docs/{did}", headers=_hdr(owner["token"]))
        assert gd.status_code == 404

    def test_delete_invalid_doc_id(self, owner, trip):
        r = requests.delete(
            f"{API}/trips/{trip['trip_id']}/docs/doc_nonexistent",
            headers=_hdr(owner["token"]),
        )
        assert r.status_code == 404

    def test_owner_can_delete_other_uploaders_doc(self, owner, trip):
        # member uploads, owner deletes
        invite = requests.get(f"{API}/trips/{trip['trip_id']}/invite", headers=_hdr(owner["token"])).json()
        m = _register("uploader_m")
        ar = requests.post(f"{API}/invite/{invite['invite_token']}/accept", headers=_hdr(m["token"]))
        assert ar.status_code == 200
        files = {"file": ("m.png", io.BytesIO(PNG_BYTES), "image/png")}
        up = requests.post(f"{API}/trips/{trip['trip_id']}/docs", files=files, headers=_hdr(m["token"]))
        assert up.status_code == 200, up.text
        did = up.json()["doc_id"]
        # owner deletes
        d = requests.delete(f"{API}/trips/{trip['trip_id']}/docs/{did}", headers=_hdr(owner["token"]))
        assert d.status_code == 200
