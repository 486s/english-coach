"""add scenarios table

Revision ID: bb6e53727e8e
Revises: 
Create Date: 2026-06-06 10:39:22.534606

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'bb6e53727e8e'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'scenarios',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('prompt_template', sa.Text(), nullable=False),
        sa.Column('icon', sa.String(length=50), nullable=True),
        sa.Column('difficulty_level', sa.String(length=20), nullable=True, server_default='intermediate'),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('tags', postgresql.JSON(), nullable=True, server_default='[]'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_index('ix_scenarios_id', 'scenarios', ['id'])
    op.create_index('ix_scenarios_name', 'scenarios', ['name'], unique=True)
    op.create_index('ix_scenarios_category', 'scenarios', ['category'])
    op.create_index('ix_scenarios_is_active', 'scenarios', ['is_active'])


def downgrade() -> None:
    op.drop_index('ix_scenarios_is_active', table_name='scenarios')
    op.drop_index('ix_scenarios_category', table_name='scenarios')
    op.drop_index('ix_scenarios_name', table_name='scenarios')
    op.drop_index('ix_scenarios_id', table_name='scenarios')
    op.drop_table('scenarios')
