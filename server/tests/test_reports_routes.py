def _create(client, headers, *, card, amount, ts=None):
    body = {"card_number": card, "amount": amount}
    if ts is not None:
        body["transaction_date"] = ts
    r = client.post("/api/transactions", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()["data"]


def _seed(client, h):
    _create(client, h, card="4267628872390355", amount="100", ts="2024-06-01T00:00:00")
    _create(client, h, card="5553959204036891", amount="-50", ts="2024-06-01T00:00:00")
    _create(client, h, card="3336208249795480", amount="500", ts="2024-12-25T00:00:00")
    _create(client, h, card="6714744990978278", amount="10", ts="2024-12-25T00:00:00")


def test_summary(client, auth_headers):
    _seed(client, auth_headers)
    r = client.get("/api/reports/summary", headers=auth_headers)
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["total_entries"] == 4
    assert d["total_amount"] == "560.00"
    assert d["highest_amount"] == "500.00"
    assert d["lowest_amount"] == "-50.00"
    assert d["deleted_count"] == 0


def test_summary_counts_deleted(client, auth_headers):
    _seed(client, auth_headers)
    # Soft-delete one row
    r = client.get("/api/transactions?page_size=1", headers=auth_headers)
    tx_id = r.json()["data"]["items"][0]["id"]
    client.delete(f"/api/transactions/{tx_id}", headers=auth_headers)

    r = client.get("/api/reports/summary", headers=auth_headers)
    d = r.json()["data"]
    assert d["total_entries"] == 3
    assert d["deleted_count"] == 1


def test_by_card_type(client, auth_headers):
    _seed(client, auth_headers)
    r = client.get("/api/reports/by-card-type", headers=auth_headers)
    assert r.status_code == 200
    rows = r.json()["data"]
    assert {r["card_type"] for r in rows} == {"Amex", "Discover", "MasterCard", "Visa"}
    by_type = {r["card_type"]: r for r in rows}
    assert by_type["Visa"]["count"] == 1
    assert by_type["Visa"]["total_amount"] == "100.00"


def test_by_card(client, auth_headers):
    _seed(client, auth_headers)
    r = client.get("/api/reports/by-card", headers=auth_headers)
    assert r.status_code == 200
    rows = r.json()["data"]
    assert len(rows) == 4
    # Biggest total first (Amex = 500)
    assert rows[0]["card_type"] == "Amex"


def test_by_day(client, auth_headers):
    _seed(client, auth_headers)
    r = client.get("/api/reports/by-day", headers=auth_headers)
    assert r.status_code == 200
    rows = r.json()["data"]
    # Two distinct days seeded
    assert len(rows) == 2
    days = sorted(r["day"] for r in rows)
    assert days == ["2024-06-01", "2024-12-25"]


def test_by_source_empty(client, auth_headers):
    r = client.get("/api/reports/by-source", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["data"] == {"upload": 0, "manual": 0, "unknown": 0, "total": 0}


def test_by_source_counts_manual_and_upload(client, auth_headers):
    # Manual entries — every POST /api/transactions stamps source=manual_entry.
    _seed(client, auth_headers)

    # Upload a file → bulk-inserts two rows with source=Batch.
    csv = (
        b"card_number,amount,timestamp\n"
        b"4111111111111111,10,2024-06-01T00:00:00\n"
        b"5555555555554444,20,2024-06-01T00:00:00\n"
    )
    r = client.post(
        "/api/uploads",
        headers=auth_headers,
        files={"file": ("tx.csv", csv, "text/csv")},
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["accepted"] == 2

    r = client.get("/api/reports/by-source", headers=auth_headers)
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["manual"] == 4
    assert d["upload"] == 2
    assert d["total"] == 6


def test_by_source_excludes_soft_deleted(client, auth_headers):
    _seed(client, auth_headers)

    # Soft-delete one row → it should drop out of the source counts.
    r = client.get("/api/transactions?page_size=1", headers=auth_headers)
    tx_id = r.json()["data"]["items"][0]["id"]
    client.delete(f"/api/transactions/{tx_id}", headers=auth_headers)

    r = client.get("/api/reports/by-source", headers=auth_headers)
    d = r.json()["data"]
    assert d["manual"] == 3
    assert d["total"] == 3


def test_reports_require_auth(client):
    for path in (
        "/api/reports/summary",
        "/api/reports/by-card",
        "/api/reports/by-card-type",
        "/api/reports/by-day",
        "/api/reports/by-source",
    ):
        r = client.get(path)
        assert r.status_code == 401, path
