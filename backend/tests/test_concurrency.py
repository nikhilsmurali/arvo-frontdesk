import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import Ticket, Agent

client = TestClient(app)

def test_concurrency_prevention_inc_0291():
    """
    Tests INC-0291 fix:
    Two agents cannot claim the same ticket concurrently.
    The second agent receives HTTP 409 Conflict.
    """
    # 1. Create a fresh ticket
    create_res = client.post("/api/tickets", json={
        "title": "Concurrent claim test ticket",
        "description": "Testing that race conditions on claim are rejected with 409 Conflict",
        "customer_name": "Test Customer",
        "customer_email": "test@customer.com",
        "priority": "MEDIUM"
    })
    assert create_res.status_code == 200
    ticket_data = create_res.json()
    ticket_id = ticket_data["id"]
    version = ticket_data["version"]

    # Retrieve agents
    agents_res = client.get("/api/agents")
    agents = agents_res.json()
    agent_1 = agents[0] # Meera
    agent_2 = agents[1] # Arjun

    # 2. Agent 1 claims ticket
    claim_1 = client.post(f"/api/tickets/{ticket_id}/claim", json={
        "agent_id": agent_1["id"],
        "expected_version": version
    })
    assert claim_1.status_code == 200
    assert claim_1.json()["assigned_agent_id"] == agent_1["id"]
    assert claim_1.json()["version"] == version + 1

    # 3. Agent 2 attempts to claim the same ticket with the stale version (or even updated version)
    claim_2_stale = client.post(f"/api/tickets/{ticket_id}/claim", json={
        "agent_id": agent_2["id"],
        "expected_version": version
    })
    assert claim_2_stale.status_code == 409
    assert "already been claimed" in claim_2_stale.json()["detail"] or "Conflict" in claim_2_stale.json()["detail"]

    # 4. Agent 2 attempts to claim with new version (still rejected because already claimed by Agent 1)
    claim_2_new_version = client.post(f"/api/tickets/{ticket_id}/claim", json={
        "agent_id": agent_2["id"],
        "expected_version": version + 1
    })
    assert claim_2_new_version.status_code == 409
    assert "already been claimed by" in claim_2_new_version.json()["detail"]

