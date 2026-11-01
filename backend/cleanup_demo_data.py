
from database import get_connection

TABLES = (
    "relief_assignments",
    "absences",
    "timetables",
    "teachers",
)

def main():
    print("ReliefMS — Demo Data Cleanup")
    print("This will delete ALL records from:")
    for table in TABLES:
        print(f"  - {table}")

    confirmation = input(
        "\nType DELETE DEMO DATA to continue: "
    )

    if confirmation != "DELETE DEMO DATA":
        print("Cancelled. No data deleted.")
        return

    with get_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")

        for table in TABLES:
            count = connection.execute(
                f"SELECT COUNT(*) FROM {table}"
            ).fetchone()[0]

            connection.execute(f"DELETE FROM {table}")
            print(f"Cleared {table}: {count} records")

    print("\nCleanup complete. Database tables preserved.")

if __name__ == "__main__":
    main()
