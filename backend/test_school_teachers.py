
import os
from dotenv import load_dotenv

from postgres_database import get_postgres_connection
from school_access import get_admin_school

load_dotenv()

# Local test account only.
# Never accept this ID from a frontend request.
admin_user_id = os.environ["TEST_ADMIN_USER_ID"]

# Find the school assigned to this administrator.
school_id = get_admin_school(admin_user_id)

if school_id is None:
    raise RuntimeError("Administrator has no assigned school")

# Retrieve only teachers belonging to this school.
with get_postgres_connection() as connection:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, name, subjects, active
            FROM teachers
            WHERE school_id = %s
            ORDER BY name
            """,
            (school_id,)
        )

        teachers = cursor.fetchall()

print("Cloud teacher query successful!")
print("Number of teachers:", len(teachers))

for teacher in teachers:
    print(
        teacher["name"],
        "-",
        teacher["subjects"]
    )
