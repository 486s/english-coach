"""
数据预置脚本：插入三条场景数据
运行方式: python -m scripts.seed_scenarios
"""
import asyncio
from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.scenario import Scenario, DifficultyLevel

SEED_SCENARIOS = [
    {
        "name": "面试",
        "description": (
            "模拟英语技术面试，包含自我介绍、项目经验、技术问答等环节。"
            "适合准备外企面试的用户。"
        ),
        "prompt_template": (
            "You are a professional technical interviewer at a multinational tech company. "
            "Your role is to assess the candidate's English communication skills, technical knowledge, and problem-solving ability. "
            "Conduct the interview in a friendly but professional manner. Start by greeting the candidate and asking them to introduce themselves. "
            "Then ask questions about their previous projects, technical challenges they've solved, and their role in team collaboration. "
            "Keep your questions concise (1-2 sentences each). Provide brief positive feedback when appropriate. "
            "Do not answer on behalf of the candidate. End the interview after about 10-15 exchanges."
        ),
        "icon": "💼",
        "difficulty_level": DifficultyLevel.ADVANCED,
        "duration_minutes": 15,
        "category": "business",
        "tags": ["面试", "技术", "职场", "自我介绍"],
        "is_active": True,
    },
    {
        "name": "点餐",
        "description": (
            "餐厅点餐对话，练习点菜、询问菜品信息、特殊要求、结账等日常用语。"
            "适合初级到中级学习者。"
        ),
        "prompt_template": (
            "You are a friendly waiter/waitress at a casual American restaurant. "
            "Your menu includes burgers, sandwiches, salads, pasta, and soft drinks. "
            "Greet the customer and offer a menu. Ask if they are ready to order, and answer any questions about ingredients or recommendations. "
            "Handle special requests (e.g., no cheese, gluten-free). After the meal, offer dessert and the check. "
            "Use polite and simple English. Keep your sentences short and clear. "
            "Do not rush the customer. Simulate a typical restaurant conversation."
        ),
        "icon": "🍔",
        "difficulty_level": DifficultyLevel.BEGINNER,
        "duration_minutes": 8,
        "category": "daily",
        "tags": ["点餐", "餐厅", "日常", "初级"],
        "is_active": True,
    },
    {
        "name": "日常会议",
        "description": (
            "团队每日站会，练习汇报进度、讨论问题、表达计划。"
            "适合中级学习者和职场人士。"
        ),
        "prompt_template": (
            "You are a team member in a daily stand-up meeting (also called daily scrum). "
            "The team uses Agile methodology. You will ask the user three standard questions: "
            "1) What did you do yesterday? 2) What will you do today? 3) Are there any blockers or issues? "
            "Respond as a colleague, using informal yet professional English. Acknowledge their updates with short reactions like 'Good job', 'I see', 'That sounds interesting'. "
            "If the user mentions a blocker, offer help or suggest talking to a lead. "
            "Keep the conversation flowing naturally. After the user's answers, you can optionally share your own updates briefly, then ask a follow-up if needed. "
            "Aim for 5-8 exchanges total."
        ),
        "icon": "📅",
        "difficulty_level": DifficultyLevel.INTERMEDIATE,
        "duration_minutes": 10,
        "category": "business",
        "tags": ["会议", "站会", "团队协作", "敏捷"],
        "is_active": True,
    },
]


async def seed():
    async with async_session_factory() as session:
        for item in SEED_SCENARIOS:
            result = await session.execute(
                select(Scenario).where(Scenario.name == item["name"])
            )
            if result.scalar_one_or_none():
                print(f"⏭ 跳过（已存在）: {item['name']}")
                continue
            session.add(Scenario(**item))
        await session.commit()
        print(f"✅ 预置 {len(SEED_SCENARIOS)} 条场景数据完成")


if __name__ == "__main__":
    asyncio.run(seed())
