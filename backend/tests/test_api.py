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
