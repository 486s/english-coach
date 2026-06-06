from sqlalchemy import Column, Integer, String, Text, Boolean, Enum, DateTime, JSON
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class DifficultyLevel(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    prompt_template = Column(Text, nullable=False)
    icon = Column(String(50), nullable=True)
    difficulty_level = Column(
        Enum(DifficultyLevel, create_constraint=False, native_enum=False),
        default=DifficultyLevel.INTERMEDIATE,
    )
    duration_minutes = Column(Integer, nullable=True)
    category = Column(String(50), nullable=True, index=True)
    tags = Column(JSON, default=lambda: [])
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # TODO(PR 4/5): 取消注释，与 Session 模型建立关系
    # sessions = relationship("Session", back_populates="scenario", lazy="selectin")
