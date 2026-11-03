
from postgres_database import get_postgres_connection

with get_postgres_connection() as connection:
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'teachers'
            ORDER BY ordinal_position
        """)

        columns = cursor.fetchall()

print("Cloud teachers table:")
for column in columns:
    print(column["column_name"], "-", column["data_type"])
