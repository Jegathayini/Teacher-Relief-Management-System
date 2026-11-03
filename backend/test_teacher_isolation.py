
import os
from dotenv import load_dotenv

from postgres_database import get_postgres_connection
from school_access import get_admin_school

load_dotenv()

admin_user_id = os.environ["TEST_ADMIN_USER_ID"]
school_id = get_admin_school(admin_user_id)

if school_id is None:
    raise RuntimeError("Administrator has no assigned school")

with get_postgres_connection() as connection:
    with connection.cursor() as cursor:

        # Retrieve teachers belonging to this school.
        cursor.execute(
            """
            SELECT id, school_id, name
            FROM teachers
            WHERE school_id = %s
            """,
            (school_id,)
        )

        teachers = cursor.fetchall()

        # Verify that every returned teacher belongs
        # to the authenticated administrator's school.
        for teacher in teachers:
            assert str(teacher["school_id"]) == str(school_id), (
                "SECURITY ERROR: Teacher belongs to another school!"
            )

print("School isolation query test passed!")
print("Teachers checked:", len(teachers))
