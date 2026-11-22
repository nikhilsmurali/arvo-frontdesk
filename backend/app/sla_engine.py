from datetime import datetime, date, time, timedelta
from typing import Optional
from app.config import settings

"""
SLA Engine for Arvo Systems Frontdesk.
Features:
1. Working hours: 9:30 AM to 6:30 PM (9.0 hours/day).
2. Monday to Friday only.
3. Excludes weekends (Saturday & Sunday).
4. Excludes festival holidays.
5. Calculates exact business hours between two timestamps.
6. Calculates target due dates by adding business minutes.
7. Supports pausing timers when waiting on customers.
8. Handles SLA recalculation when priority changes mid-ticket.
"""

def is_working_day(dt: datetime | date) -> bool:
    d = dt if isinstance(dt, date) and not isinstance(dt, datetime) else dt.date()
    # 0 = Monday, 4 = Friday, 5 = Saturday, 6 = Sunday
    if d.weekday() not in settings.WORK_DAYS:
        return False
    date_str = d.strftime("%Y-%m-%d")
    if date_str in settings.FESTIVAL_HOLIDAYS:
        return False
    return True

def get_work_start_time() -> time:
    return time(settings.WORK_START_HOUR, settings.WORK_START_MINUTE)

def get_work_end_time() -> time:
    return time(settings.WORK_END_HOUR, settings.WORK_END_MINUTE)

def get_daily_working_minutes() -> int:
    start = get_work_start_time()
    end = get_work_end_time()
    return (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute) # 540 mins = 9 hrs

def snap_to_next_working_time(dt: datetime) -> datetime:
    """
    If dt falls outside working hours (before start, after end, weekend, or holiday),
    snap it forward to the start of the next valid working period.
    """
    current = dt
    start_time = get_work_start_time()
    end_time = get_work_end_time()

    while True:
        # Check if current day is working day
        if not is_working_day(current):
            # Advance to next day at 09:30
            current = datetime.combine(current.date() + timedelta(days=1), start_time)
            continue
        
        # Current day is a working day
        current_time = current.time()
        if current_time < start_time:
            return datetime.combine(current.date(), start_time)
        elif current_time >= end_time:
            # Advance to next day 09:30
            current = datetime.combine(current.date() + timedelta(days=1), start_time)
            continue
        else:
            # Within working hours
            return current

def calculate_working_minutes(start_dt: datetime, end_dt: datetime) -> int:
    """
    Calculate exact elapsed working minutes between start_dt and end_dt.
    Excludes weekends, holidays, and off-hours.
    """
    if end_dt <= start_dt:
        return 0

    start = snap_to_next_working_time(start_dt)
    if end_dt <= start:
        return 0

    total_minutes = 0
    current = start
    end_time = get_work_end_time()
    start_time = get_work_start_time()

    while current < end_dt:
        if not is_working_day(current):
            current = datetime.combine(current.date() + timedelta(days=1), start_time)
            continue

        work_end = datetime.combine(current.date(), end_time)
        
        if current >= work_end:
            current = datetime.combine(current.date() + timedelta(days=1), start_time)
            continue

        # Active interval for current working day
        segment_end = min(end_dt, work_end)
        if segment_end > current:
            diff = (segment_end - current).total_seconds() / 60
            total_minutes += int(diff)
            current = segment_end
        
        if current >= work_end:
            current = datetime.combine(current.date() + timedelta(days=1), start_time)

    return total_minutes

def add_working_minutes(start_dt: datetime, minutes_to_add: int) -> datetime:
    """
    Add specified working minutes to start_dt, respecting working hours (09:30-18:30),
    skipping weekends and festival holidays.
    """
    current = snap_to_next_working_time(start_dt)
    remaining_minutes = minutes_to_add
    start_time = get_work_start_time()
    end_time = get_work_end_time()

    while remaining_minutes > 0:
        if not is_working_day(current):
            current = datetime.combine(current.date() + timedelta(days=1), start_time)
            continue

        day_end = datetime.combine(current.date(), end_time)
        available_today = int((day_end - current).total_seconds() / 60)

        if remaining_minutes <= available_today:
            return current + timedelta(minutes=remaining_minutes)
        else:
            remaining_minutes -= available_today
            current = datetime.combine(current.date() + timedelta(days=1), start_time)

    return current

def calculate_urgent_resolution_due(created_at: datetime) -> datetime:
    """
    For urgent problems: "fix it the same working day".
    If ticket arrives during business hours on a working day, due at 18:30 that day.
    If ticket arrives after hours / weekend / holiday, snapped to next working day 09:30,
    and due at 18:30 of that working day.
    """
    snapped = snap_to_next_working_time(created_at)
    return datetime.combine(snapped.date(), get_work_end_time())

def calculate_initial_sla_targets(priority: str, created_at: datetime) -> dict:
    """
    Compute initial first response and resolution targets for a newly created ticket.
    """
    priority = priority.upper()
    
    if priority == "URGENT":
        first_response_due = add_working_minutes(created_at, settings.SLA_URGENT_FIRST_RESPONSE_MINUTES)
        resolution_due = calculate_urgent_resolution_due(created_at)
    elif priority == "MEDIUM":
        first_response_due = add_working_minutes(created_at, settings.SLA_MEDIUM_FIRST_RESPONSE_MINUTES)
        resolution_due = add_working_minutes(created_at, settings.SLA_MEDIUM_RESOLUTION_MINUTES)
    elif priority == "LOW":
        first_response_due = add_working_minutes(created_at, settings.SLA_LOW_FIRST_RESPONSE_MINUTES)
        resolution_due = add_working_minutes(created_at, settings.SLA_LOW_RESOLUTION_MINUTES)
    else:
        # Default fallback to Medium
        first_response_due = add_working_minutes(created_at, settings.SLA_MEDIUM_FIRST_RESPONSE_MINUTES)
        resolution_due = add_working_minutes(created_at, settings.SLA_MEDIUM_RESOLUTION_MINUTES)

    return {
        "first_response_due_at": first_response_due,
        "resolution_due_at": resolution_due
    }

def recalculate_sla_on_priority_change(
    ticket_created_at: datetime,
    old_priority: str,
    new_priority: str,
    first_response_done: bool,
    total_paused_minutes: int,
    now: datetime
) -> dict:
    """
    Address the Section 3 question:
    "What happens to the timer if we change a ticket to urgent in the middle? Nobody knew the answer."
    
    Our deterministic policy:
    1. First Response SLA:
       - If first response was already completed, the first response SLA is already locked in (fulfilled).
       - If not yet completed:
         Elapsed active working minutes = calculate_working_minutes(ticket_created_at, now) - total_paused_minutes.
         Urgent target total allowance = 120 working minutes.
         Remaining allowance = 120 - elapsed_active_working_minutes.
         If remaining allowance <= 0: Ticket is immediately flagged as First Response Breached!
         If remaining allowance > 0: Add remaining allowance to now.
    2. Resolution SLA:
       - If changed to Urgent: must be fixed the same working day (or 9 working hours from creation).
       - If changed to Medium or Low: recompute from created_at using new priority minutes + paused minutes.
    """
    new_p = new_priority.upper()
    elapsed_active_minutes = max(0, calculate_working_minutes(ticket_created_at, now) - total_paused_minutes)

    # First Response SLA target
    if first_response_done:
        new_first_response_due = None # Kept as is or already met
    else:
        target_allowance = {
            "URGENT": settings.SLA_URGENT_FIRST_RESPONSE_MINUTES,
            "MEDIUM": settings.SLA_MEDIUM_FIRST_RESPONSE_MINUTES,
            "LOW": settings.SLA_LOW_FIRST_RESPONSE_MINUTES
        }.get(new_p, settings.SLA_MEDIUM_FIRST_RESPONSE_MINUTES)

        remaining = target_allowance - elapsed_active_minutes
        if remaining <= 0:
            # Breached immediately or due now
            new_first_response_due = now
        else:
            new_first_response_due = add_working_minutes(now, remaining)

    # Resolution SLA target
    if new_p == "URGENT":
        new_resolution_due = calculate_urgent_resolution_due(now)
    elif new_p == "MEDIUM":
        total_allowance = settings.SLA_MEDIUM_RESOLUTION_MINUTES
        remaining = total_allowance - elapsed_active_minutes
        if remaining <= 0:
            new_resolution_due = now
        else:
            new_resolution_due = add_working_minutes(now, remaining)
    else: # LOW
        total_allowance = settings.SLA_LOW_RESOLUTION_MINUTES
        remaining = total_allowance - elapsed_active_minutes
        if remaining <= 0:
            new_resolution_due = now
        else:
            new_resolution_due = add_working_minutes(now, remaining)

    return {
        "first_response_due_at": new_first_response_due,
        "resolution_due_at": new_resolution_due,
        "elapsed_active_minutes": elapsed_active_minutes
    }

