from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import Ticket

client = TestClient(app)

def test_reopen_window_policy():
    """
    Tests reopen window:
    'If a customer is unhappy after we mark a ticket as done, they should be able to open it again.
     But only for about one week. After that it is a new ticket, not the old one.'
    """
    ticket_res = client.post("/api/tickets", json={
        "title": "Reopen window validation",
        "description": "Verifying 1-week reopen rule",
        "customer_name": "Reopen Tester",
        "customer_email": "reopen@test.com",
        "priority": "LOW"
    })
    ticket = ticket_res.json()
    ticket_id = ticket["id"]
    ticket_num = ticket["ticket_number"]

    agent = client.get("/api/agents").json()[0]

    # Resolve ticket
    client.post(f"/api/tickets/{ticket_id}/status", json={
        "agent_id": agent["id"],
        "new_status": "RESOLVED"
    })

    # Case 1: Reopen within 1 week -> SUCCESS
    reopen_res = client.post(f"/api/customer/tickets/{ticket_num}/reopen", json={
        "customer_email": "reopen@test.com",
        "reason": "Problem recurred this morning"
    })
    assert reopen_res.status_code == 200
    assert reopen_res.json()["status"] == "IN_PROGRESS"

    # Case 2: Resolve again and simulate resolved_at > 7 days ago
    client.post(f"/api/tickets/{ticket_id}/status", json={
        "agent_id": agent["id"],
        "new_status": "RESOLVED"
    })

    with SessionLocal() as db:
        t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        t.resolved_at = datetime.utcnow() - timedelta(days=8) # 8 days ago (> 1 week)
        db.commit()

    # Customer attempts to reopen -> REJECTED with 400
    expired_reopen_res = client.post(f"/api/customer/tickets/{ticket_num}/reopen", json={
        "customer_email": "reopen@test.com",
        "reason": "Still broken after 8 days"
    })
    assert expired_reopen_res.status_code == 400
    assert "expired" in expired_reopen_res.json()["detail"]
