import io


CSV_VALID = (
    b"cardNumber,timestamp,amount\n"
    b"4267628872390355,2024-01-01T00:00:00,100.00\n"
    b"5553959204036891,2024-01-02T00:00:00,-50.00\n"
)

CSV_MIXED = CSV_VALID + b"BADCARD,2024-01-03T00:00:00,10\n"

JSON_VALID = (
    b'[{"cardNumber":"4267628872390355","amount":100,"timestamp":"2024-01-01T00:00:00"}]'
)

XML_VALID = (
    b"<transactions>"
    b"<transaction>"
    b"<cardNumber>4267628872390355</cardNumber>"
    b"<amount>100</amount>"
    b"<timestamp>2024-01-01T00:00:00</timestamp>"
    b"</transaction>"
    b"</transactions>"
)


def test_upload_csv(client, auth_headers):
    r = client.post(
        "/api/uploads",
        headers=auth_headers,
        files={"file": ("test.csv", io.BytesIO(CSV_VALID), "text/csv")},
    )
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["source_format"] == "csv"
    assert d["accepted"] == 2
    assert d["rejected"] == 0

    # Rows are stamped with source + file_name.
    r = client.get("/api/transactions", headers=auth_headers)
    items = r.json()["data"]["items"]
    assert all(i["source"] == "Batch" for i in items)
    assert all(i["file_name"] == "test.csv" for i in items)


def test_upload_rejects_bad_rows(client, auth_headers):
    r = client.post(
        "/api/uploads",
        headers=auth_headers,
        files={"file": ("mixed.csv", io.BytesIO(CSV_MIXED), "text/csv")},
    )
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["accepted"] == 2
    assert d["rejected"] == 1
    assert len(d["rejected_samples"]) == 1


def test_upload_json(client, auth_headers):
    r = client.post(
        "/api/uploads",
        headers=auth_headers,
        files={"file": ("data.json", io.BytesIO(JSON_VALID), "application/json")},
    )
    assert r.status_code == 200
    assert r.json()["data"]["accepted"] == 1


def test_upload_xml(client, auth_headers):
    r = client.post(
        "/api/uploads",
        headers=auth_headers,
        files={"file": ("data.xml", io.BytesIO(XML_VALID), "application/xml")},
    )
    assert r.status_code == 200
    assert r.json()["data"]["accepted"] == 1


def test_upload_unsupported_extension(client, auth_headers):
    r = client.post(
        "/api/uploads",
        headers=auth_headers,
        files={"file": ("data.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert r.status_code == 400


def test_upload_requires_auth(client):
    r = client.post(
        "/api/uploads",
        files={"file": ("x.csv", io.BytesIO(b""), "text/csv")},
    )
    assert r.status_code == 401
