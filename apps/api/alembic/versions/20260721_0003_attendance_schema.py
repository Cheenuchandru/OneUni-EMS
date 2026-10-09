"""Create punches table schema

Revision ID: 20260721_0003
Revises: 20260721_0002
Create Date: 2026-07-21 19:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20260721_0003'
down_revision: Union[str, None] = '20260721_0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        'punches',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('punch_type', sa.String(), nullable=False),
        sa.Column('claimed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('server_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('ip', sa.String(), nullable=False),
        sa.Column('user_agent', sa.String(), nullable=False),
        sa.Column('device_type', sa.String(), nullable=False),
        sa.Column('os_name', sa.String(), nullable=False),
        sa.Column('os_version', sa.String(), nullable=False),
        sa.Column('browser', sa.String(), nullable=False),
        sa.Column('work_mode', sa.String(), nullable=False, server_default='office'),
        sa.Column('day', sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'day', 'punch_type', name='uq_user_day_punchtype')
    )
    op.create_index(op.f('ix_punches_user_id'), 'punches', ['user_id'], unique=False)
    op.create_index(op.f('ix_punches_day'), 'punches', ['day'], unique=False)

def downgrade() -> None:
    op.drop_table('punches')
