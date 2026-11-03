
from postgres_database import get_postgres_connection


def get_admin_school(user_id):
    if not isinstance(user_id, str) or not user_id:
        raise ValueError("Authenticated user ID is required")

    with get_postgres_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT school_id
                FROM school_admins
                WHERE user_id = %s
                """,
                (user_id,)
            )

            row = cursor.fetchone()

    if row is None:
        return None

    return row["school_id"]
