from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from app.models.scenario import DifficultyLevel


class ScenarioResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    difficulty_level: DifficultyLevel
    duration_minutes: Optional[int] = None
    category: Optional[str] = None
    tags: list = []
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ScenarioListResponse(BaseModel):
    scenarios: list[ScenarioResponse]
    total: int


class ScenarioCreate(BaseModel):
    """预留：后续用于 POST /scenarios"""
    name: str
    description: Optional[str] = None
    prompt_template: str
    icon: Optional[str] = None
    difficulty_level: DifficultyLevel = DifficultyLevel.INTERMEDIATE
    duration_minutes: Optional[int] = None
    category: Optional[str] = None
    tags: list = []
    is_active: bool = True
