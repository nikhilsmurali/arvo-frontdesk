from datetime import datetime, date, time
import pytest
from app.sla_engine import (
    is_working_day, snap_to_next_working_time, calculate_working_minutes,
    add_working_minutes, calculate_initial_sla_targets, recalculate_sla_on_priority_change
)
from app.config import settings

def test_working_day_and_weekends():
    # 2026-11-20 is Friday (working)
    fri = date(2026, 11, 20)
    assert is_working_day(fri) is True

    # 2026-11-21 is Saturday (weekend)
    sat = date(2026, 11, 21)
    assert is_working_day(sat) is False

    # 2026-11-22 is Sunday (weekend)
    sun = date(2026, 11, 22)
    assert is_working_day(sun) is False

def test_festival_holidays():
    # Republic day in config: 2026-01-26 (Monday)
    holiday = date(2026, 1, 26)
    assert is_working_day(holiday) is False

def test_friday_6pm_ticket_not_late_on_sunday_morning():
    """
    Directly tests Meera's quote:
    'If a ticket arrives at 6 PM on Friday, it should not be late on Sunday morning.
     Right now our spreadsheet says it is late.'
    """
    # Ticket arrives Friday 18:00 (6:00 PM)
    # Working day ends at 18:30 (6:30 PM), so only 30 working minutes remain on Friday.
    fri_6pm = datetime(2026, 11, 20, 18, 0, 0)
    
    # Urgent SLA is 2 hours (120 working minutes).
    # Target due date should be Monday 11:00 AM (30 mins on Friday + 90 mins on Monday starting 09:30).
    urgent_due = add_working_minutes(fri_6pm, 120)
    assert urgent_due == datetime(2026, 11, 23, 11, 0, 0) # Monday 11:00 AM

    # On Sunday 10:00 AM:
    sun_10am = datetime(2026, 11, 22, 10, 0, 0)
    elapsed_working_mins_on_sunday = calculate_working_minutes(fri_6pm, sun_10am)
    
    # Elapsed working time should ONLY be the 30 minutes from Friday!
    assert elapsed_working_mins_on_sunday == 30
    assert sun_10am < urgent_due  # Definitely NOT late!

def test_sla_targets_calculation():
    # Monday 10:00 AM
    mon_10am = datetime(2026, 11, 23, 10, 0, 0)

    # Urgent: 2 hours response (120 mins) -> Monday 12:00 PM
    # Urgent resolution: same working day (18:30)
    urgent_sla = calculate_initial_sla_targets("URGENT", mon_10am)
    assert urgent_sla["first_response_due_at"] == datetime(2026, 11, 23, 12, 0, 0)
    assert urgent_sla["resolution_due_at"] == datetime(2026, 11, 23, 18, 30, 0)

    # Medium: 4.5 hours response (270 mins) -> Monday 14:30 (2:30 PM)
    # Resolution: 3 working days (3 * 540 min = 1620 min) -> Thursday 10:00 AM
    med_sla = calculate_initial_sla_targets("MEDIUM", mon_10am)
    assert med_sla["first_response_due_at"] == datetime(2026, 11, 23, 14, 30, 0)
    assert med_sla["resolution_due_at"] == datetime(2026, 11, 26, 10, 0, 0)

def test_priority_change_timer_logic():
    """
    Answers Section 3 question:
    'What happens to the timer if we change a ticket to urgent in the middle?'
    """
    # Ticket created Monday 10:00 AM as Medium (4.5 hr / 270 min reply SLA)
    created_at = datetime(2026, 11, 23, 10, 0, 0)
    
    # Case 1: Changed to Urgent at 11:00 AM (1 hr elapsed active working time, < 2 hr urgent allowance)
    at_11am = datetime(2026, 11, 23, 11, 0, 0)
    recalc = recalculate_sla_on_priority_change(
        ticket_created_at=created_at,
        old_priority="MEDIUM",
        new_priority="URGENT",
        first_response_done=False,
        total_paused_minutes=0,
        now=at_11am
    )
    # 60 mins remaining of 120 min Urgent SLA -> Due at 12:00 PM
    assert recalc["first_response_due_at"] == datetime(2026, 11, 23, 12, 0, 0)

    # Case 2: Changed to Urgent at 13:00 PM (3 hrs elapsed, already exceeds 2 hr Urgent allowance)
    at_1pm = datetime(2026, 11, 23, 13, 0, 0)
    recalc_breached = recalculate_sla_on_priority_change(
        ticket_created_at=created_at,
        old_priority="MEDIUM",
        new_priority="URGENT",
        first_response_done=False,
        total_paused_minutes=0,
        now=at_1pm
    )
    # Should flag due immediately (breached)
    assert recalc_breached["first_response_due_at"] == at_1pm

