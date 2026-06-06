from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.scenario import Scenario
from app.schemas.scenario import ScenarioResponse, ScenarioListResponse

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.get("/", response_model=ScenarioListResponse)
async def list_scenarios(db: AsyncSession = Depends(get_db)):
    """获取所有活跃场景列表"""
    result = await db.execute(
        select(Scenario)
        .where(Scenario.is_active == True)
        .order_by(Scenario.id)
    )
    scenarios = result.scalars().all()
    return ScenarioListResponse(
        scenarios=[ScenarioResponse.model_validate(s) for s in scenarios],
        total=len(scenarios),
    )


@router.get("/{scenario_id}", response_model=ScenarioResponse)
async def get_scenario(scenario_id: int, db: AsyncSession = Depends(get_db)):
    """获取单个场景详情，包含 prompt_template"""
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return ScenarioResponse.model_validate(scenario)
