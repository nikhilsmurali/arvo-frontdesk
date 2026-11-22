import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_internal_notes_never_leaked_to_customer_inc_0304():
    """
    Tests INC-0304 fix:
    'An agent wrote a private note for the team... By mistake, the note was sent to that customer.
     Private team notes must never be shown to a customer. Not on a screen. Not in an API response.
     Not in an export. Not in a list.'
    """
    # 1. Create a ticket
    ticket_res = client.post("/api/tickets", json={
        "title": "Billing discrepancy on invoice #9921",
        "description": "We noticed a double charge on our latest credit card invoice.",
        "customer_name": "Valued Enterprise Client",
        "customer_email": "finance@enterprise.com",
        "priority": "HIGH" if False else "MEDIUM"
    })
    ticket = ticket_res.json()
    ticket_id = ticket["id"]
    ticket_num = ticket["ticket_number"]

    # Get an agent
    agent = client.get("/api/agents").json()[0]

    # 2. Agent posts a PUBLIC reply
    public_res = client.post(
        f"/api/tickets/{ticket_id}/messages?agent_id={agent['id']}",
        json={
            "body": "Hello Valued Client, we are reviewing your invoice double charge now.",
            "is_internal": False
        }
    )
    assert public_res.status_code == 200

    # 3. Agent posts a SENSITIVE PRIVATE NOTE
    secret_note_text = "CONFIDENTIAL INTERNAL NOTE: Customer has been difficult before. Do not offer a refund without manager approval."
    internal_res = client.post(
        f"/api/tickets/{ticket_id}/messages?agent_id={agent['id']}",
        json={
            "body": secret_note_text,
            "is_internal": True
        }
    )
    assert internal_res.status_code == 200

    # 4. Verify that AGENT can see both public reply and internal note
    agent_view = client.get(f"/api/tickets/{ticket_id}").json()
    agent_message_bodies = [m["body"] for m in agent_view["messages"]]
    assert any("we are reviewing your invoice" in b for b in agent_message_bodies)
    assert any(secret_note_text in b for b in agent_message_bodies)

    # 5. Verify that CUSTOMER endpoint strictly EXCLUDES the internal note!
    customer_view = client.get(f"/api/customer/tickets/{ticket_num}").json()
    customer_message_bodies = [m["body"] for m in customer_view["messages"]]
    
    # Public reply is visible to customer
    assert any("we are reviewing your invoice" in b for b in customer_message_bodies)

    # PRIVATE NOTE IS 100% ABSENT!
    for b in customer_message_bodies:
        assert secret_note_text not in b
        assert "CONFIDENTIAL" not in b
        assert "difficult" not in b
    
    # Schema check: customer message items do not even contain an 'is_internal' flag
    for msg in customer_view["messages"]:
        assert "is_internal" not in msg
