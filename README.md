# Frontdesk — Support Desk for Arvo Systems

**Frontdesk** is a modern, reliable customer support platform built for **Arvo Systems** to replace their legacy shared spreadsheet and WhatsApp workflow.

It was designed from the ground up to solve the real-world operational breakdowns experienced by Arvo's support team:
- **INC-0291**: Prevention of concurrent ticket claiming and contradictory replies.
- **INC-0304**: Strict data privacy ensuring internal team notes are never exposed to customers.
- **INC-0318**: Immutable, append-only audit trail providing verifiable proof of what happened, when, and who did it.
- **Accurate Business Hours SLA Engine**: True business hours (09:30–18:30, Mon–Fri), weekend and festival holiday exclusions, SLA timer pausing while waiting on customer responses, 1-week auto-closure, and 1-week customer reopen window.

---

## Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy 2.0, Pydantic V2, Pytest.
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Database**: PostgreSQL (production via Docker Compose) & SQLite (zero-config local dev fallback).
- **Architecture**: Modular REST API with strict DTO response isolation and optimistic concurrency control (OCC).

---

## Quick Start (Two Ways to Run)

### Option 1: Docker Compose (PostgreSQL + Backend + Frontend)

The fastest way to run the complete production-like stack with PostgreSQL:

```bash
# Clone the repository
git clone <repo-url>
cd nav-tech

# Build and start all services (PostgreSQL, FastAPI Backend, React Frontend)
docker-compose up --build
```

- **Agent Support Workbench**: [http://localhost:3000](http://localhost:3000)
- **Backend API Docs (Swagger / OpenAPI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

### Option 2: Run Locally (Without Docker)

You can run the backend and frontend directly on your machine. The backend automatically defaults to a self-contained SQLite database with pre-seeded agents and tickets, requiring zero database installation.

#### 1. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run automated tests
pytest tests -v

# Start backend server (runs on port 8000)
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend Setup
In a new terminal:
```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server (runs on port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Key Features & How They Address Requirements

### 1. The 9 Arvo Support Agents Pre-Seeded
In the top navigation bar, you can instantly switch between all 9 Arvo support team members:
- **Meera** (Support Lead)
- **Arjun** (Senior Support Agent)
- **Priya**, **Rahul**, **Ananya**, **Vikram**, **Sneha**, **Rohan**, **Neha** (Support Agents)

### 2. INC-0291: Concurrency Control on Ticket Claim
- When two agents open the same ticket, both see the current version `v1`.
- When Agent A clicks **"Take This Ticket"**, the backend atomically updates `assigned_agent_id` and increments `version` to `v2`.
- When Agent B tries to claim the ticket, the backend detects the conflict and returns `HTTP 409 Conflict`:
  > *"Conflict: Ticket INC-0332 has already been claimed by Meera."*
- Agent B's UI immediately disables the claim button and shows that the ticket belongs to Meera, preventing conflicting responses.

### 3. INC-0304: Zero-Leakage Privacy for Team Notes
- When an agent adds an **Internal Team Note**, the message is marked `is_internal = True`.
- In the **Agent Workbench**, internal notes appear with an amber alert box and a lock icon: `"Internal Team Note (Hidden from Customer)"`.
- In the **Customer Portal** (`/api/customer/tickets/:ticket_number`), internal notes are stripped at both:
  1. The **Database query level** (`WHERE is_internal = false`).
  2. The **Pydantic schema level** (`CustomerTicketRead` does not contain `is_internal` or agent-private fields).
- Switch to the **"Customer Portal"** tab in the top navigation bar to verify live that no internal notes are visible to customers.

### 4. INC-0318: Verifiable, Append-Only Audit Trail
- Click on any ticket and navigate to the **"Audit Timeline"** tab.
- Every state change, message, claim, SLA pause, SLA resume, and priority adjustment is recorded in the `ticket_events` table with:
  - Actor Name and Actor Type (`AGENT`, `CUSTOMER`, `SYSTEM`)
  - Action Type (e.g., `CREATED`, `CLAIMED`, `PUBLIC_REPLY_SENT`, `SLA_PAUSED`)
  - Microsecond UTC timestamp
  - Metadata diff
- This table has **no UPDATE or DELETE endpoints**, making it an immutable record of truth.

### 5. SLA Engine & Working Hours Rules
- **Working Hours**: Monday to Friday, 09:30 to 18:30 (9.0 working hours per day).
- **Weekends**: Saturdays and Sundays have 0 working hours.
- **Festival Holidays**: Configurable list of statutory holidays (e.g. Republic Day, Diwali, Christmas).
- **The Friday 6:00 PM Test**:
  - A ticket arriving on Friday at 6:00 PM has only 30 minutes of working time remaining on Friday.
  - On Saturday and Sunday, elapsed working time remains exactly 30 minutes.
  - On Sunday morning, **it is NOT late**, directly solving Meera's spreadsheet complaint.
- **SLA Pausing**:
  - Changing status to `WAITING_ON_CUSTOMER` pauses the SLA clock.
  - When the customer replies or the status returns to `IN_PROGRESS`, the exact paused business minutes are added to the deadlines.
- **Auto-Close**:
  - Tickets waiting on customer responses for > 1 working week (45 working hours / 2700 working minutes) are automatically closed with an audit log reason.
- **1-Week Customer Reopen Window**:
  - Customers can reopen resolved tickets within 7 days.
  - Attempts to reopen after 7 days are rejected with `HTTP 400 Bad Request`.

### 6. The Meeting Question: Priority Change Mid-Flight
Documented in detail in [`NOTE.md`](./NOTE.md):
- When a ticket's priority is upgraded to **Urgent**, the system calculates active elapsed business hours against the 2-hour Urgent allowance.
- If already over 2 hours, it triggers an immediate first-response breach alert.
- If under 2 hours, the remaining allowance is scheduled into upcoming business hours.
- Resolution deadline snaps to the end of the current working day (18:30).

---

## Automated Verification & Test Suite

Run the full automated test suite to verify all rules:

```bash
cd backend
venv\Scripts\pytest tests -v
```

### Test Coverage Summary:
- `tests/test_concurrency.py`: Proves concurrent claims by two agents trigger `409 Conflict` (INC-0291).
- `tests/test_note_privacy.py`: Proves customer endpoints strictly omit internal notes (INC-0304).
- `tests/test_audit_log.py`: Proves every action records immutable audit events (INC-0318).
- `tests/test_sla_engine.py`: Proves working hours, holiday exclusions, Friday 6 PM ticket not late on Sunday morning, and priority change calculations.
- `tests/test_reopen_and_autoclose.py`: Proves 1-week reopen enforcement and 45-hour auto-close rule.

