"""CRUD + filtering + sorting + pagination tests for /api/transactions."""
from __future__ import annotations


def _create(client, headers, *, card="4267628872390354", amount="100.00", remarks=None, ts=None):
    body = {"card_number": card, "amount": amount}
    if remarks is not None:
        body["remarks"] = remarks
    if ts is not None:
        body["transaction_date"] = ts
    r = client.post("/api/transactions", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()["data"]


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


class TestCreate:
    def test_happy_path(self, client, auth_headers):
        tx = _create(client, auth_headers, amount="123.45", remarks="groceries")
        assert tx["card_number"] == "4267628872390354"
        assert tx["card_type"] == "Visa"
        assert tx["amount"] == "123.45"
        assert tx["status"] == "success"
        assert tx["source"] == "manual_entry"
        assert tx["remarks"] == "groceries"
        assert tx["is_deleted"] is False
        # user_id should be stamped from the authenticated admin
        assert tx["user_id"]

    def test_requires_auth(self, client):
        r = client.post(
            "/api/transactions",
            json={"card_number": "4267628872390354", "amount": "10"},
        )
        assert r.status_code == 401

    def test_invalid_card_is_rejected(self, client, auth_headers):
        r = client.post(
            "/api/transactions",
            headers=auth_headers,
            json={"card_number": "9999999999999999", "amount": "10"},
        )
        assert r.status_code == 400
        assert "unrecognized" in r.json()["detail"].lower()

    def test_card_number_too_short(self, client, auth_headers):
        r = client.post(
            "/api/transactions",
            headers=auth_headers,
            json={"card_number": "4267", "amount": "10"},
        )
        # Pydantic min_length validation
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Read / list / sort / pagination
# ---------------------------------------------------------------------------


class TestList:
    def test_pagination(self, client, auth_headers):
        for i in range(5):
            _create(client, auth_headers, amount=f"{10 + i}")
        r = client.get(
            "/api/transactions?page=1&page_size=2&sort_by=amount&sort_dir=asc",
            headers=auth_headers,
        )
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["total"] == 5
        assert d["page"] == 1
        assert d["page_size"] == 2
        assert len(d["items"]) == 2
        assert [i["amount"] for i in d["items"]] == ["10.00", "11.00"]

    def test_sort_desc(self, client, auth_headers):
        for i in range(3):
            _create(client, auth_headers, amount=f"{10 + i}")
        r = client.get(
            "/api/transactions?sort_by=amount&sort_dir=desc", headers=auth_headers
        )
        amounts = [i["amount"] for i in r.json()["data"]["items"]]
        assert amounts == ["12.00", "11.00", "10.00"]

    def test_search_by_substring(self, client, auth_headers):
        _create(client, auth_headers, card="4267628872390354")
        _create(client, auth_headers, card="5553959204036898")
        r = client.get("/api/transactions?search=4267", headers=auth_headers)
        d = r.json()["data"]
        assert d["total"] == 1
        assert d["items"][0]["card_number"] == "4267628872390354"


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------


class TestFilters:
    def setup_data(self, client, h):
        # 3 rows: Visa, MC, Amex at different dates + amounts
        _create(client, h, card="4267628872390354", amount="100", ts="2024-06-01T00:00:00")
        _create(client, h, card="5553959204036898", amount="-50", ts="2024-06-15T00:00:00")
        _create(client, h, card="3336208249795483", amount="500", ts="2024-12-25T00:00:00")

    def test_card_type_visa(self, client, auth_headers):
        self.setup_data(client, auth_headers)
        r = client.get("/api/transactions?card_type=Visa", headers=auth_headers)
        d = r.json()["data"]
        assert d["total"] == 1
        assert d["items"][0]["card_type"] == "Visa"

    def test_card_type_amex(self, client, auth_headers):
        self.setup_data(client, auth_headers)
        r = client.get("/api/transactions?card_type=Amex", headers=auth_headers)
        assert r.json()["data"]["total"] == 1

    def test_card_type_all_when_omitted(self, client, auth_headers):
        self.setup_data(client, auth_headers)
        r = client.get("/api/transactions", headers=auth_headers)
        assert r.json()["data"]["total"] == 3

    def test_date_range(self, client, auth_headers):
        self.setup_data(client, auth_headers)
        r = client.get(
            "/api/transactions?date_from=2024-06-01T00:00:00&date_to=2024-06-30T23:59:59",
            headers=auth_headers,
        )
        assert r.json()["data"]["total"] == 2

    def test_amount_range(self, client, auth_headers):
        self.setup_data(client, auth_headers)
        r = client.get(
            "/api/transactions?amount_min=0&amount_max=200", headers=auth_headers
        )
        assert r.json()["data"]["total"] == 1

    def test_amount_negative_only(self, client, auth_headers):
        self.setup_data(client, auth_headers)
        r = client.get("/api/transactions?amount_max=0", headers=auth_headers)
        d = r.json()["data"]
        assert d["total"] == 1
        assert d["items"][0]["amount"] == "-50.00"

    def test_combined_filters(self, client, auth_headers):
        self.setup_data(client, auth_headers)
        r = client.get(
            "/api/transactions?card_type=Visa&amount_min=0&date_from=2024-01-01T00:00:00&date_to=2024-12-31T23:59:59",
            headers=auth_headers,
        )
        assert r.json()["data"]["total"] == 1

    def test_exact_card_number(self, client, auth_headers):
        self.setup_data(client, auth_headers)
        r = client.get(
            "/api/transactions?card_number=5553959204036898", headers=auth_headers
        )
        assert r.json()["data"]["total"] == 1

    def test_filter_by_source(self, client, auth_headers):
        _create(client, auth_headers)
        r = client.get(
            "/api/transactions?source=manual_entry", headers=auth_headers
        )
        assert r.json()["data"]["total"] == 1
        r = client.get(
            "/api/transactions?source=file_upload", headers=auth_headers
        )
        assert r.json()["data"]["total"] == 0


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


class TestUpdate:
    def test_patch_amount_status_remarks(self, client, auth_headers):
        tx = _create(client, auth_headers)
        r = client.put(
            f"/api/transactions/{tx['id']}",
            headers=auth_headers,
            json={"amount": "999.99", "status": "pending", "remarks": "edited"},
        )
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["amount"] == "999.99"
        assert d["status"] == "pending"
        assert d["remarks"] == "edited"

    def test_update_missing_row_404(self, client, auth_headers):
        r = client.put(
            "/api/transactions/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
            json={"amount": "1"},
        )
        assert r.status_code == 404

    def test_invalid_status_rejected(self, client, auth_headers):
        tx = _create(client, auth_headers)
        r = client.put(
            f"/api/transactions/{tx['id']}",
            headers=auth_headers,
            json={"status": "lol"},
        )
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Soft delete + restore
# ---------------------------------------------------------------------------


class TestDeleteRestore:
    def test_delete_soft(self, client, auth_headers):
        tx = _create(client, auth_headers)
        r = client.delete(f"/api/transactions/{tx['id']}", headers=auth_headers)
        assert r.status_code == 200

        # Not in default list
        r = client.get("/api/transactions", headers=auth_headers)
        assert r.json()["data"]["total"] == 0

        # Visible with include_deleted=true
        r = client.get(
            "/api/transactions?include_deleted=true", headers=auth_headers
        )
        d = r.json()["data"]
        assert d["total"] == 1
        assert d["items"][0]["is_deleted"] is True

    def test_restore(self, client, auth_headers):
        tx = _create(client, auth_headers)
        client.delete(f"/api/transactions/{tx['id']}", headers=auth_headers)
        r = client.post(
            f"/api/transactions/{tx['id']}/restore", headers=auth_headers
        )
        assert r.status_code == 200

        r = client.get("/api/transactions", headers=auth_headers)
        assert r.json()["data"]["total"] == 1

    def test_restore_active_row_returns_404(self, client, auth_headers):
        tx = _create(client, auth_headers)
        r = client.post(
            f"/api/transactions/{tx['id']}/restore", headers=auth_headers
        )
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Bulk create
# ---------------------------------------------------------------------------


def test_bulk_create(client, auth_headers):
    r = client.post(
        "/api/transactions/bulk",
        headers=auth_headers,
        json={
            "items": [
                {"card_number": "4267628872390354", "amount": "10"},
                {"card_number": "5553959204036898", "amount": "20"},
                {"card_number": "9999999999999999", "amount": "30"},  # invalid leader
            ]
        },
    )
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["accepted"] == 2
    assert d["rejected"] == 1
    assert len(d["rejected_samples"]) == 1
