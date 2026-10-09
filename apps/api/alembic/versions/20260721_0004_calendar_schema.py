"""Create calendar tables schema

Revision ID: 20260721_0004
Revises: 20260721_0003
Create Date: 2026-07-21 19:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20260721_0004'
down_revision: Union[str, None] = '20260721_0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        'calendar_days',
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('day_type', sa.String(), nullable=False, server_default='working'),
        sa.Column('label', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('date')
    )

    op.create_table(
        'calendar_day_status',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('source', sa.String(), nullable=False, server_default='auto'),
        sa.Column('marked_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'date', name='uq_user_date_status')
    )
    op.create_index(op.f('ix_calendar_day_status_user_id'), 'calendar_day_status', ['user_id'], unique=False)
    op.create_index(op.f('ix_calendar_day_status_date'), 'calendar_day_status', ['date'], unique=False)

def downgrade() -> None:
    op.drop_table('calendar_day_status')
    op.drop_table('calendar_days')
