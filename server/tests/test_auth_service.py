import time

import pytest

from app.config import settings
from app.services import auth_service
from app.services.auth_service import (
    WeakPasswordError,
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)


# All real passwords used here are 8+ chars to satisfy the minimum-strength
# check that hash_password enforces in production.
STRONG_PW = "hunter22"


class TestPasswordHashing:
    def test_hash_then_verify(self):
        h = hash_password(STRONG_PW)
        assert h != STRONG_PW
        assert verify_password(STRONG_PW, h) is True

    def test_wrong_password_fails(self):
        h = hash_password(STRONG_PW)
        assert verify_password("nopesorry", h) is False

    def test_hashes_are_salted(self):
        assert hash_password("same_pwd8") != hash_password("same_pwd8")

    def test_long_password_is_truncated_safely(self):
        # bcrypt caps at 72 bytes — the helper must silently handle that.
        long_pw = "a" * 200
        h = hash_password(long_pw)
        assert verify_password(long_pw, h) is True
        # Anything sharing the first 72 bytes should also validate.
        assert verify_password("a" * 72 + "zzzz", h) is True

    def test_verify_returns_false_for_garbage_hash(self):
        assert verify_password("anything", "not-a-bcrypt-hash") is False

    def test_hash_rejects_weak_password(self):
        # Too short — must never land on disk.
        with pytest.raises(WeakPasswordError):
            hash_password("short")
        with pytest.raises(WeakPasswordError):
            hash_password("")


class TestJWT:
    def test_round_trip(self):
        token, expires_in = create_access_token("admin")
        assert isinstance(token, str) and token.count(".") == 2
        assert expires_in == settings.jwt_expires_minutes * 60
        assert decode_token(token) == "admin"

    def test_invalid_token_returns_none(self):
        assert decode_token("garbage") is None

    def test_tampered_token_returns_none(self):
        token, _ = create_access_token("admin")
        tampered = token[:-4] + "AAAA"
        assert decode_token(tampered) is None

    def test_expired_token_returns_none(self, monkeypatch):
        # Shrink the expiry and sleep through it.
        monkeypatch.setattr(settings, "jwt_expires_minutes", 0)
        token, _ = create_access_token("admin")
        time.sleep(1.1)
        assert decode_token(token) is None
