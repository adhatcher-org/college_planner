from datetime import date
from decimal import Decimal

from app.models import Child, CollegeAccount, User


def test_register_login_create_child_and_registry(client):
    register = client.post(
        "/api/auth/register",
        json={
            "email": "new@example.com",
            "first_name": "New",
            "last_name": "User",
            "password": "ChangeM3!Now",
        },
    )
    assert register.status_code == 201

    login = client.post(
        "/api/auth/login",
        json={"email": "new@example.com", "password": "ChangeM3!Now"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    child = client.post(
        "/api/children",
        headers=headers,
        json={
            "first_name": "Avery",
            "college_start_date": "2030-08-01",
            "initial_balance": "500.00",
        },
    )
    assert child.status_code == 201
    account_id = child.json()["account"]["id"]
    assert child.json()["college_end_date"] == "2034-05-01"

    deposit = client.post(
        "/api/schedules/deposits",
        headers=headers,
        json={
            "account_id": account_id,
            "start_date": "2026-01-01",
            "end_date": "2026-03-31",
            "amount": "100.00",
            "description": "Monthly contribution",
            "frequency": "monthly",
            "recurrence": {},
        },
    )
    assert deposit.status_code == 201

    registry = client.get(
        f"/api/registry/{account_id}?start_date=2026-01-01&end_date=2026-03-31",
        headers=headers,
    )
    assert registry.status_code == 200
    rows = registry.json()["rows"]
    assert rows
    assert "amount" in rows[0]
    assert "deposit_amount" not in rows[0]
    assert "expense_amount" not in rows[0]
    assert "investment_income_amount" not in rows[0]


def test_admin_bootstrap_forces_password_reset(client):
    login = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "ChangeM3!"},
    )
    assert login.status_code == 200
    assert login.json()["force_password_reset"] is True


def test_account_profile_email_password_and_delete(client, db_session):
    first = client.post(
        "/api/auth/register",
        json={
            "email": "first@example.com",
            "first_name": "First",
            "last_name": "User",
            "password": "ChangeM3!Now",
        },
    )
    assert first.status_code == 201
    second = client.post(
        "/api/auth/register",
        json={
            "email": "second@example.com",
            "first_name": "Second",
            "last_name": "User",
            "password": "ChangeM3!Now",
        },
    )
    assert second.status_code == 201

    login = client.post(
        "/api/auth/login",
        json={"email": "first@example.com", "password": "ChangeM3!Now"},
    )
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    profile = client.patch("/api/auth/me", headers=headers, json={"first_name": "Updated", "last_name": "Parent"})
    assert profile.status_code == 200
    assert profile.json()["first_name"] == "Updated"
    assert profile.json()["last_name"] == "Parent"

    email_without_password = client.patch("/api/auth/me", headers=headers, json={"email": "renamed@example.com"})
    assert email_without_password.status_code == 400

    duplicate_email = client.patch(
        "/api/auth/me",
        headers=headers,
        json={"email": "second@example.com", "current_password": "ChangeM3!Now"},
    )
    assert duplicate_email.status_code == 409

    email_change = client.patch(
        "/api/auth/me",
        headers=headers,
        json={"email": "renamed@example.com", "current_password": "ChangeM3!Now"},
    )
    assert email_change.status_code == 200
    assert email_change.json()["email"] == "renamed@example.com"

    bad_password_change = client.post(
        "/api/auth/change-password",
        headers=headers,
        json={"current_password": "wrong-password", "new_password": "ChangeM3!Later"},
    )
    assert bad_password_change.status_code == 400

    password_change = client.post(
        "/api/auth/change-password",
        headers=headers,
        json={"current_password": "ChangeM3!Now", "new_password": "ChangeM3!Later"},
    )
    assert password_change.status_code == 200

    old_login = client.post(
        "/api/auth/login",
        json={"email": "renamed@example.com", "password": "ChangeM3!Now"},
    )
    assert old_login.status_code == 401
    new_login = client.post(
        "/api/auth/login",
        json={"email": "renamed@example.com", "password": "ChangeM3!Later"},
    )
    assert new_login.status_code == 200
    delete_headers = {"Authorization": f"Bearer {new_login.json()['access_token']}"}

    user = db_session.query(User).filter(User.email == "renamed@example.com").one()
    child = Child(
        owner=user,
        first_name="Avery",
        college_start_date=date(2030, 8, 1),
        college_end_date=date(2034, 5, 1),
    )
    child.account = CollegeAccount(initial_balance=Decimal("100.00"))
    db_session.add(child)
    db_session.commit()
    child_id = child.id
    account_id = child.account.id

    bad_delete = client.request(
        "DELETE",
        "/api/auth/me",
        headers=delete_headers,
        json={"current_password": "wrong-password"},
    )
    assert bad_delete.status_code == 400

    delete = client.request(
        "DELETE",
        "/api/auth/me",
        headers=delete_headers,
        json={"current_password": "ChangeM3!Later"},
    )
    assert delete.status_code == 204
    assert db_session.get(User, user.id) is None
    assert db_session.get(Child, child_id) is None
    assert db_session.get(CollegeAccount, account_id) is None
