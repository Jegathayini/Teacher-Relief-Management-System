
import os

from dotenv import load_dotenv
from school_access import get_admin_school

load_dotenv()

user_id = os.getenv("TEST_ADMIN_USER_ID")

if not user_id:
    raise RuntimeError(
        "TEST_ADMIN_USER_ID is missing from .env"
    )

school_id = get_admin_school(user_id)

if school_id is None:
    print("Administrator has no assigned school.")
else:
    print("Administrator-school lookup successful!")
    print("School ID found:", bool(school_id))
