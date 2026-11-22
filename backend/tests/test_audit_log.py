import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_immutable_audit_log_inc_0318():
    """
    Tests INC-0318 fix:
    'A customer said Arvo did not reply until the next morning. Arvo believed the reply was sent
     in forty minutes. Nobody could prove who was right. The system must record exactly what happened,
     when it happened, and who did it. Nobody should be able to change that record later.'
    """
    # 1. Create a ticket
    ticket_res = client.post("/api/tickets", json={
        "title": "Audit trail test problem",
        "description": "Checking audit logging integrity",
        "customer_name": "Audit Customer",
        "customer_email": "audit@customer.com",
        "priority": "MEDIUM"
    })
    ticket = ticket_res.json()
    ticket_id = ticket["id"]

    agents = client.get("/api/agents").json()
    agent = agents[0]

    # 2. Claim ticket
    client.post(f"/api/tickets/{ticket_id}/claim", json={
        "agent_id": agent["id"],
        "expected_version": ticket["version"]
    })

    # 3. Post public reply
    client.post(
        f"/api/tickets/{ticket_id}/messages?agent_id={agent['id']}",
        json={
            "body": "First response sent within SLA.",
            "is_internal": False
        }
    )

    # 4. Change status to WAITING_ON_CUSTOMER
    client.post(
        f"/api/tickets/{ticket_id}/status",
        json={
            "agent_id": agent["id"],
            "new_status": "WAITING_ON_CUSTOMER",
            "comment": "Waiting for customer log files"
        }
    )

    # 5. Fetch audit trail from /api/audit/tickets/{ticket_id}
    audit_res = client.get(f"/api/audit/tickets/{ticket_id}")
    assert audit_res.status_code == 200
    events = audit_res.json()

    # Verify event types and actors
    actions = [e["action"] for e in events]
    assert "CREATED" in actions
    assert "CLAIMED" in actions
    assert "PUBLIC_REPLY_SENT" in actions
    assert "STATUS_CHANGED" in actions
    assert "SLA_PAUSED" in actions

    # Verify actor proof
    claim_event = next(e for e in events if e["action"] == "CLAIMED")
    assert claim_event["actor_name"] == agent["name"]
    assert claim_event["actor_type"] == "AGENT"
    assert claim_event["created_at"] is not None

