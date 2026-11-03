
import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

database_url = os.getenv("DATABASE_URL")

if not database_url:
    raise RuntimeError("DATABASE_URL is missing from .env")

try:
    with psycopg.connect(
        database_url,
        connect_timeout=10,
        sslmode="require"
    ) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT current_database(), current_user"
            )
            result = cursor.fetchone()

            print("PostgreSQL connection successful!")
            print("Database:", result[0])
            print("Connected user:", result[1])

except psycopg.Error as error:
    print("PostgreSQL connection failed!")
    print("Error type:", type(error).__name__)
