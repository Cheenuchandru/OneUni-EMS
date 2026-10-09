"""Create eod tables schema

Revision ID: 20260721_0006
Revises: 20260721_0005
Create Date: 2026-07-21 19:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20260721_0006'
down_revision: Union[str, None] = '20260721_0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        'eod_templates',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('body_md', sa.String(), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'eod_reports',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('template_id', sa.String(), nullable=True),
        sa.Column('body_md', sa.String(), nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('locked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('reviewed_by', sa.String(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('review_note', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['template_id'], ['eod_templates.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'date', name='uq_user_date_eod')
    )

    op.create_index(op.f('ix_eod_reports_user_id'), 'eod_reports', ['user_id'], unique=False)
    op.create_index(op.f('ix_eod_reports_date'), 'eod_reports', ['date'], unique=False)

def downgrade() -> None:
    op.drop_table('eod_reports')
    op.drop_table('eod_templates')
