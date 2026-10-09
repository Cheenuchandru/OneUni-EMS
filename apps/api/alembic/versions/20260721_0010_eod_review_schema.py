"""Add review columns to eod_reports table

Revision ID: 20260721_0010
Revises: 20260721_0009
Create Date: 2026-07-21 20:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20260721_0010'
down_revision: Union[str, None] = '20260721_0009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('eod_reports', sa.Column('reviewed_by', sa.String(), nullable=True))
    op.add_column('eod_reports', sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('eod_reports', sa.Column('review_note', sa.String(), nullable=True))

def downgrade() -> None:
    op.drop_column('eod_reports', 'review_note')
    op.drop_column('eod_reports', 'reviewed_at')
    op.drop_column('eod_reports', 'reviewed_by')
