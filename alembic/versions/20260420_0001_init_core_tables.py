"""init core tables

Revision ID: 20260420_0001
Revises:
Create Date: 2026-04-20
"""

from alembic import op
import sqlalchemy as sa


revision = "20260420_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "action_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_record_id", sa.Integer(), nullable=False),
        sa.Column("source_date", sa.Date(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("priority", sa.Text(), nullable=False, server_default="medium"),
        sa.Column("status", sa.Text(), nullable=False, server_default="todo"),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_action_items_id"), "action_items", ["id"], unique=False)
    op.create_index(op.f("ix_action_items_source_date"), "action_items", ["source_date"], unique=False)
    op.create_index(op.f("ix_action_items_source_record_id"), "action_items", ["source_record_id"], unique=False)

    op.create_table(
        "daily_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("chat_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("screenshot_paths_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("screenshot_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("analysis_summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("tags_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_daily_records_id"), "daily_records", ["id"], unique=False)
    op.create_index(op.f("ix_daily_records_record_date"), "daily_records", ["record_date"], unique=False)

    op.create_table(
        "notification_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("channel", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("success", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("response_message", sa.Text(), nullable=False, server_default=""),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notification_logs_id"), "notification_logs", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_notification_logs_id"), table_name="notification_logs")
    op.drop_table("notification_logs")
    op.drop_index(op.f("ix_daily_records_record_date"), table_name="daily_records")
    op.drop_index(op.f("ix_daily_records_id"), table_name="daily_records")
    op.drop_table("daily_records")
    op.drop_index(op.f("ix_action_items_source_record_id"), table_name="action_items")
    op.drop_index(op.f("ix_action_items_source_date"), table_name="action_items")
    op.drop_index(op.f("ix_action_items_id"), table_name="action_items")
    op.drop_table("action_items")
