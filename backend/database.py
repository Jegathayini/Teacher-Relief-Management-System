
import json
import sqlite3
from pathlib import Path


DATABASE_PATH = Path(__file__).resolve().parent / "reliefms.db"


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database():
    with get_connection() as connection:

        # 1. Teachers table
        connection.execute("""
            CREATE TABLE IF NOT EXISTS teachers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                subjects TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 1
                    CHECK (active IN (0, 1))
            )
        """)

        # 2. Timetables table
        connection.execute("""
            CREATE TABLE IF NOT EXISTS timetables (
                id TEXT PRIMARY KEY,
                teacher_id TEXT NOT NULL,
                class_name TEXT NOT NULL,
                subject TEXT NOT NULL,
                day TEXT NOT NULL,
                period INTEGER NOT NULL CHECK (period > 0),

                FOREIGN KEY (teacher_id)
                    REFERENCES teachers(id)
                    ON DELETE RESTRICT,

                UNIQUE(day, period, class_name),
                UNIQUE(day, period, teacher_id)
            )
        """)

        # 3. Absences table
        connection.execute("""
            CREATE TABLE IF NOT EXISTS absences (
                id TEXT PRIMARY KEY,
                teacher_id TEXT NOT NULL,
                date TEXT NOT NULL,
                reason TEXT NOT NULL DEFAULT '',

                FOREIGN KEY (teacher_id)
                    REFERENCES teachers(id)
                    ON DELETE RESTRICT,

                UNIQUE(teacher_id, date)
            )
        """)

        # 4. Relief assignments table
        connection.execute("""
            CREATE TABLE IF NOT EXISTS relief_assignments (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                period INTEGER NOT NULL
                    CHECK (period BETWEEN 1 AND 8),
                class_name TEXT NOT NULL,
                absent_teacher_id TEXT NOT NULL,
                relief_teacher_id TEXT NOT NULL,
                subject TEXT NOT NULL,

                FOREIGN KEY (absent_teacher_id)
                    REFERENCES teachers(id)
                    ON DELETE RESTRICT,

                FOREIGN KEY (relief_teacher_id)
                    REFERENCES teachers(id)
                    ON DELETE RESTRICT,

                UNIQUE(date, period, class_name),
                UNIQUE(date, period, relief_teacher_id),

                CHECK (absent_teacher_id != relief_teacher_id)
            )
        """)

    print("ReliefMS database initialized successfully")


def import_teachers(teachers):
    if not isinstance(teachers, list):
        raise ValueError("Teachers must be a list")

    validated = []
    seen_ids = set()

    for teacher in teachers:
        if not isinstance(teacher, dict):
            raise ValueError("Each teacher must be an object")

        teacher_id = teacher.get("id")
        name = teacher.get("name")
        subjects = teacher.get("subjects")
        active = teacher.get("active")

        if not isinstance(teacher_id, str) or not teacher_id.strip():
            raise ValueError("Invalid teacher ID")

        if teacher_id in seen_ids:
            raise ValueError("Duplicate teacher ID in import")

        seen_ids.add(teacher_id)

        if not isinstance(name, str) or not name.strip():
            raise ValueError("Invalid teacher name")

        if (
            not isinstance(subjects, list)
            or not subjects
            or not all(
                isinstance(subject, str) and subject.strip()
                for subject in subjects
            )
        ):
            raise ValueError("Invalid teacher subjects")

        if not isinstance(active, bool):
            raise ValueError("Invalid teacher active status")

        validated.append((
            teacher_id,
            name.strip(),
            json.dumps(subjects),
            int(active)
        ))

    with get_connection() as connection:
        existing_ids = {
            row["id"]
            for row in connection.execute(
                "SELECT id FROM teachers"
            ).fetchall()
        }

        duplicates = [
            teacher_id
            for teacher_id, _, _, _ in validated
            if teacher_id in existing_ids
        ]

        if duplicates:
            raise ValueError(
                "Some teachers already exist in the database. "
                "Import cancelled to prevent overwriting."
            )

        connection.executemany(
            """
            INSERT INTO teachers (id, name, subjects, active)
            VALUES (?, ?, ?, ?)
            """,
            validated
        )

    return len(validated)
