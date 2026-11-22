# Section 5: Engineering Notes & Analysis

This document provides explicit answers to the questions raised in the Arvo Systems hiring specification (Sections 3, 4, and 5).

---

## 1. What did you not finish, and why?

> *"Running out of time is normal. Not knowing what you skipped is not."*

Within the ~8-hour project envelope, our focus was directed at **core correctness, data integrity, and solving the three specific business failures (INC-0291, INC-0304, INC-0318)** along with the complex business hours SLA engine.

### Items intentionally deferred and why:

1. **Production Inbound Email Parser (IMAP/SendGrid/SES Ingestion)**:
   - *Why deferred*: In a real production helpdesk, customers email `support@arvo.com` to file tickets. Building webhook signature verification, DKIM/SPF checking, HTML-to-text multipart body sanitization, and attachment antivirus scanning would have consumed 4+ hours alone.
   - *Alternative provided*: An interactive **Customer Portal & Ticket Creation API**, allowing full end-to-end simulation of ticket creation, customer replies (which trigger SLA unpausing), and customer reopening within the 1-week window.

2. **Automated Cron Daemon / Celery Beat Scheduler**:
   - *Why deferred*: Running a distributed background worker (e.g. Celery + Redis or Temporal) introduces extra infrastructure dependencies that make quick local evaluation cumbersome.
   - *Alternative provided*: A clean **SLA Maintenance Sweep Endpoint** (`POST /api/tickets/sweep-sla`) accessible via a single click in the UI header ("SLA Sweep") or via any standard HTTP cron (e.g., AWS EventBridge, cronjob, or GitHub Actions). In production, this endpoint runs every 60 seconds to auto-close inactive tickets and detect breaches.

3. **Complex Rich-Text / WYSIWYG Editor with Inline Image Attachments**:
   - *Why deferred*: Markdown and plain-text messaging was prioritized to focus on **zero data leakage (INC-0304)** and **tamper-proof audit logging (INC-0318)**. WYSIWYG editors often introduce XSS attack surfaces and require cloud bucket storage (S3/GCS) for embedded image hosting.

4. **WebSockets / Server-Sent Events (SSE) for Real-Time Lock Indicators**:
   - *Why deferred*: Implementing WebSockets across diverse deployment targets (e.g. serverless Vercel or ephemeral containers) often causes connection termination issues without Redis pub/sub.
   - *Alternative provided*: Robust **Optimistic Concurrency Control (OCC)** at the database layer. If Agent B attempts to claim a ticket that Agent A just claimed, Agent B is immediately presented with an HTTP 409 Conflict explaining exactly who claimed the ticket and preventing duplicate responses.

---

## 2. The Meeting Question: What happens to the timer if we change a ticket to urgent in the middle?

> *"Someone asked a question in the meeting. What happens to the timer if we change a ticket to urgent in the middle? Nobody knew the answer. We moved to the next topic."*

### The Business Dilemma
If a ticket has been sitting as **Medium** for 3 hours (where the First Response allowance was 4.5 hours), and the customer calls in escalating it to **Urgent** (where the initial SLA allowance was 2 hours):
- Did Arvo already breach the SLA (since 3 hours > 2 hours)?
- Or do agents get 2 brand-new hours starting from the moment of escalation?

### Arvo Frontdesk's Deterministic Policy (Implemented in `app/sla_engine.py`):

1. **If First Response has already occurred:**
   - The First Response SLA is already locked and fulfilled. Changing priority does not retroactively penalize or re-evaluate the initial response.
   - The **Resolution SLA** is adjusted: Urgent tickets require same-day fix (by 18:30 of the current business day).

2. **If First Response has NOT yet occurred:**
   - We calculate **Active Elapsed Business Minutes** (`elapsed_working_minutes - total_paused_minutes`).
   - We compare this elapsed time against the Urgent SLA allowance (120 business minutes / 2 business hours):
     - **Case A: Elapsed Time < 120 minutes:**
       - Remaining time is: `120 - elapsed_time`.
       - Target due date is set to `now + remaining_time` (projected forward into valid business hours).
       - Example: If 45 minutes have elapsed, the agent has 75 minutes remaining to respond.
     - **Case B: Elapsed Time ≥ 120 minutes:**
       - The ticket is **immediately flagged as First Response Breached**.
       - It is prioritized to the top of the agent dashboard with a flashing red breach alert.
       - The audit log explicitly notes:
         `"Priority upgraded from MEDIUM to URGENT. Active elapsed time (180 mins) exceeds Urgent allowance (120 mins). SLA target set to immediate breach."`

3. **Resolution SLA Recalculation:**
   - Urgent tickets must be fixed the same working day (snapped to 18:30 of the current working day, or the next working day if changed after hours).

4. **Full Audit Visibility:**
   - An immutable event `PRIORITY_CHANGED` is recorded with actor name, timestamp, previous targets, and new recalculated deadlines.

---

## 3. Incident Solutions Summary

| Incident | Root Problem | Arvo Frontdesk Architectural Solution |
| :--- | :--- | :--- |
| **INC-0291** | Race condition: Two agents clicked "Take this ticket" simultaneously and sent contradictory replies. | **Optimistic Concurrency & Atomic Claim**: Versioning check (`version = expected_version`) and atomic database lock. Second agent receives HTTP 409 Conflict with informative notice: *"Ticket has already been claimed by [Agent Name]"*. |
| **INC-0304** | Private team note leaked to customer. | **Zero-Leakage Dual Insulation**: Separate `is_internal` attribute on messages. Customer endpoints (`/api/customer/tickets/:id`) filter out internal notes at the SQL query level **and** the Pydantic response serializer level. Even if query filtering fails, the model serializer guarantees internal notes cannot be emitted in JSON. Dedicated automated test proves internal notes are 100% absent. |
| **INC-0318** | Disputed response time between customer and Arvo; spreadsheet had no verifiable history. | **Immutable Audit Log (Append-Only Event Store)**: `ticket_events` table logs every state change, message, claim, and SLA pause with microsecond timestamps and actor identities. No update or delete endpoints exist for this log. |

