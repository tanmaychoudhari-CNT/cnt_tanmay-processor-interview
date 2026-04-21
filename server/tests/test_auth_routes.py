def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "ok"


def test_login_success(client):
    r = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["access_token"]
    assert data["token_type"] == "bearer"
    assert data["username"] == "admin"
    assert data["expires_in"] > 0


def test_login_wrong_password(client):
    r = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong"},
    )
    assert r.status_code == 401
    assert "invalid" in r.json()["detail"].lower()


def test_login_unknown_user(client):
    r = client.post(
        "/api/auth/login",
        json={"username": "ghost", "password": "x"},
    )
    assert r.status_code == 401


def test_me_requires_auth(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_me_with_token(client, auth_headers):
    r = client.get("/api/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["data"]["username"] == "admin"


def test_logout(client, auth_headers):
    r = client.post("/api/auth/logout", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["message"] == "logged out"


def test_protected_route_rejects_garbage_token(client):
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer total-garbage"})
    assert r.status_code == 401
