import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Frontdesk - Arvo Support Desk"
    # Default to SQLite for zero-friction local run; can be overridden via DATABASE_URL
    # e.g., postgresql+psycopg2://postgres:postgres@localhost:5432/frontdesk
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./frontdesk.db")
    
    # Business Hours Configuration
    WORK_START_HOUR: int = 9
    WORK_START_MINUTE: int = 30
    WORK_END_HOUR: int = 18
    WORK_END_MINUTE: int = 30
    
    # Working Days (0=Monday, 4=Friday, 5=Saturday, 6=Sunday)
    WORK_DAYS: list[int] = [0, 1, 2, 3, 4]
    
    # Pre-configured Festival Holidays (YYYY-MM-DD format)
    # E.g. Republic Day, Independence Day, Diwali, Christmas, etc.
    FESTIVAL_HOLIDAYS: list[str] = [
        "2026-01-26", # Republic Day
        "2026-08-15", # Independence Day
        "2026-10-02", # Gandhi Jayanti
        "2026-10-20", # Festival Holiday (Dussehra)
        "2026-11-08", # Festival Holiday (Diwali)
        "2026-12-25", # Christmas
    ]

    # SLA Settings (in working minutes)
    # 9 hours / day = 540 working minutes
    SLA_URGENT_FIRST_RESPONSE_MINUTES: int = 120  # 2 hours
    SLA_MEDIUM_FIRST_RESPONSE_MINUTES: int = 270  # 4.5 hours ("half a day")
    SLA_LOW_FIRST_RESPONSE_MINUTES: int = 540     # 9 hours ("1 working day")

    SLA_MEDIUM_RESOLUTION_MINUTES: int = 1620     # 3 working days (3 * 540 min)
    SLA_LOW_RESOLUTION_MINUTES: int = 2700        # 5 working days ("1 working week", 5 * 540 min)

    # Inactivity auto-closure threshold: 1 working week = 5 working days = 2700 working minutes
    AUTO_CLOSE_WAITING_MINUTES: int = 2700

    # Reopen window: 7 calendar days in seconds
    REOPEN_WINDOW_DAYS: int = 7

    model_config = {"env_file": ".env", "extra": "allow"}

settings = Settings()
