"""Create mail routing_rules and outbox schema

Revision ID: 20260721_0008
Revises: 20260721_0007
Create Date: 2026-07-21 20:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20260721_0008'
down_revision: Union[str, None] = '20260721_0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        'mail_routing_rules',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('recipient_type', sa.String(), nullable=False),
        sa.Column('recipient_value', sa.String(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_mail_routing_rules_event_type'), 'mail_routing_rules', ['event_type'], unique=False)

    op.create_table(
        'mail_outbox',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('to_emails', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_error', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_mail_outbox_event_type'), 'mail_outbox', ['event_type'], unique=False)
    op.create_index(op.f('ix_mail_outbox_status'), 'mail_outbox', ['status'], unique=False)

def downgrade() -> None:
    op.drop_table('mail_outbox')
    op.drop_table('mail_routing_rules')
