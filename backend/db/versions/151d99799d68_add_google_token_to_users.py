"""Add google token to users

Revision ID: 151d99799d68
Revises: edf2a1a862cc
Create Date: 2021-08-15 14:29:02.542171

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "151d99799d68"
down_revision = "edf2a1a862cc"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column("users", sa.Column("google_auth_token", sa.String(), nullable=True))
    op.add_column(
        "users", sa.Column("google_refresh_token", sa.String(), nullable=True)
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("users", "google_auth_token")
    op.drop_column("users", "google_refresh_token")
    # ### end Alembic commands ###
