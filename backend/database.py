
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
        connection.execute("""
            CREATE TABLE IF NOT EXISTS teachers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                subjects TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 1
                    CHECK (active IN (0, 1))
            )
        """)

    print("ReliefMS database initialized successfully")


import json


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
