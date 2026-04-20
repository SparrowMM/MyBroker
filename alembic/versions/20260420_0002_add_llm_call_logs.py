"""add llm call logs

Revision ID: 20260420_0002
Revises: 20260420_0001
Create Date: 2026-04-20
"""

from alembic import op
import sqlalchemy as sa


revision = "20260420_0002"
down_revision = "20260420_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_call_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scenario", sa.Text(), nullable=False, server_default="summary"),
        sa.Column("model", sa.Text(), nullable=False, server_default=""),
        sa.Column("prompt_digest", sa.Text(), nullable=False, server_default=""),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.Text(), nullable=False, server_default="unknown"),
        sa.Column("error_message", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_llm_call_logs_id"), "llm_call_logs", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_llm_call_logs_id"), table_name="llm_call_logs")
    op.drop_table("llm_call_logs")
