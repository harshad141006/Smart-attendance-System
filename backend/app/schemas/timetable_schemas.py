from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class PeriodBase(BaseModel):
    title: str = Field(..., description="e.g. Data Structures or Lunch Break")
    start_time: str = Field(..., description="HH:MM format, e.g. 09:00")
    end_time: str = Field(..., description="HH:MM format, e.g. 10:00")
    is_break: bool = Field(default=False)
    faculty_id: Optional[str] = None
    subject_id: Optional[str] = None

class PeriodCreate(PeriodBase):
    pass

class PeriodResponse(PeriodBase):
    id: str

class TimetableCreate(BaseModel):
    batch: str
    department: str
    section: str
    day_of_week: str = Field(..., description="Monday, Tuesday, etc.")
    periods: List[PeriodCreate]

class TimetableResponse(BaseModel):
    id: str
    batch: str
    department: str
    section: str
    day_of_week: str
    periods: List[PeriodResponse]
    created_at: datetime
    updated_at: datetime
