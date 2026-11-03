from database import (initialize_database, import_teachers,get_connection)
from auth_middleware import require_school_admin
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import json
from uuid import uuid4
from psycopg import sql
import sqlite3
from datetime import date
from io import BytesIO
import os
import tempfile
from postgres_database import get_postgres_connection
from uuid import uuid4

app = Flask(__name__)
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5173",
                "http://127.0.0.1:5173"
            ]
        }
    },
    allow_headers=["Authorization", "Content-Type"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
)

from flask import g
from auth_middleware import require_school_admin


@app.before_request
def protect_api_routes():
    # Browser CORS preflight requests do not carry login tokens.
    if request.method == "OPTIONS":
        return None

    if request.path == "/api/health":
        return None

    if request.path.startswith("/api/"):
        @require_school_admin
        def authenticated_request():
            return None

        return authenticated_request()

    return None

@app.get("/")
def home():
    return jsonify({
        "system": "Teacher Relief Management System",
        "backend": "Flask",
        "status": "running",
        "api_health": "/api/health"
    })

# Allow requests from the local React development server
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://127.0.0.1:5173"]
    }
})


@app.get("/api/health")
def health_check():
    return jsonify({
        "status": "success",
        "message": "Teacher Relief Management API is running"
    })




@app.get("/api/cloud/teachers")
@require_school_admin
def get_cloud_teachers():
    school_id = g.school_id

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

            rows = cursor.fetchall()

    teachers = []

    for row in rows:
        subjects = row["subjects"] or ""

        teachers.append({
            "id": row["id"],
            "name": row["name"],
            "subjects": [
                subject.strip()
                for subject in subjects.split(",")
                if subject.strip()
            ],
            "active": bool(row["active"])
        })

    return jsonify(teachers)


@app.put("/api/cloud/teachers/<teacher_id>")
@require_school_admin
def update_cloud_teacher(teacher_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"message": "Invalid request body."}), 400

    name = data.get("name")
    subjects = data.get("subjects")

    if not isinstance(name, str) or not name.strip():
        return jsonify({"message": "Teacher name is required."}), 400

    if not isinstance(subjects, list):
        return jsonify({"message": "Subjects must be an array."}), 400

    clean_subjects = list(dict.fromkeys(
        subject.strip()
        for subject in subjects
        if isinstance(subject, str) and subject.strip()
    ))

    if not clean_subjects:
        return jsonify({"message": "At least one subject is required."}), 400

    with get_postgres_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE teachers
                SET name = %s, subjects = %s
                WHERE id = %s AND school_id = %s
                RETURNING id, name, subjects, active
                """,
                (
                    name.strip(),
                    ", ".join(clean_subjects),
                    teacher_id,
                    g.school_id
                )
            )

            teacher = cursor.fetchone()

    if teacher is None:
        return jsonify({"message": "Teacher not found."}), 404

    return jsonify({
        "id": teacher["id"],
        "name": teacher["name"],
        "subjects": [
            subject.strip()
            for subject in teacher["subjects"].split(",")
            if subject.strip()
        ],
        "active": bool(teacher["active"])
    })


@app.patch("/api/cloud/teachers/<teacher_id>/status")
@require_school_admin
def update_cloud_teacher_status(teacher_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict) or type(data.get("active")) is not bool:
        return jsonify({
            "message": "The active field must be true or false."
        }), 400

    active = data["active"]

    with get_postgres_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE teachers
                SET active = %s
                WHERE id = %s AND school_id = %s
                RETURNING id, name, subjects, active
                """,
                (int(active), teacher_id, g.school_id)
            )

            teacher = cursor.fetchone()

    if teacher is None:
        return jsonify({
            "message": "Teacher not found."
        }), 404

    return jsonify({
        "id": teacher["id"],
        "name": teacher["name"],
        "subjects": [
            subject.strip()
            for subject in (teacher["subjects"] or "").split(",")
            if subject.strip()
        ],
        "active": bool(teacher["active"])
    })


@app.delete("/api/cloud/teachers/<teacher_id>")
@require_school_admin
def delete_cloud_teacher(teacher_id):
    try:
        with get_postgres_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    DELETE FROM teachers
                    WHERE id = %s AND school_id = %s
                    RETURNING id
                    """,
                    (teacher_id, g.school_id)
                )

                deleted = cursor.fetchone()

        if deleted is None:
            return jsonify({
                "message": "Teacher not found."
            }), 404

        return jsonify({
            "message": "Teacher deleted successfully."
        }), 200

    except Exception:
        app.logger.exception("Failed to delete cloud teacher")
        return jsonify({
            "message": "Unable to delete teacher. The teacher may have linked records."
        }), 409


@app.post("/api/cloud/teachers")
@require_school_admin
def create_cloud_teacher():
    from uuid import uuid4

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "message": "Invalid request body."
        }), 400

    name = data.get("name")
    subjects = data.get("subjects")

    if not isinstance(name, str) or not name.strip():
        return jsonify({
            "message": "Teacher name is required."
        }), 400

    if not isinstance(subjects, list):
        return jsonify({
            "message": "Subjects must be an array."
        }), 400

    clean_name = name.strip()

    clean_subjects = list(dict.fromkeys(
        subject.strip()
        for subject in subjects
        if isinstance(subject, str) and subject.strip()
    ))

    if not clean_subjects:
        return jsonify({
            "message": "At least one subject is required."
        }), 400

    teacher_id = str(uuid4())
    school_id = g.school_id

    with get_postgres_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO teachers
                    (id, school_id, name, subjects, active)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, name, subjects, active
                """,
                (
                    teacher_id,
                    school_id,
                    clean_name,
                    ", ".join(clean_subjects),
                    1
                )
            )

            row = cursor.fetchone()

    return jsonify({
        "id": row["id"],
        "name": row["name"],
        "subjects": clean_subjects,
        "active": bool(row["active"])
    }), 201


@app.get("/api/teachers")
@require_school_admin
def get_teachers():
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT id, name, subjects, active
            FROM teachers
            ORDER BY name ASC
        """).fetchall()

    teachers = []

    for row in rows:
        teachers.append({
            "id": row["id"],
            "name": row["name"],
            "subjects": json.loads(row["subjects"]),
            "active": bool(row["active"])
        })

    return jsonify(teachers)


@app.post("/api/teachers")
def create_teacher():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "A valid JSON object is required"
        }), 400

    name = data.get("name")
    subjects = data.get("subjects")

    # Validate teacher name
    if not isinstance(name, str) or not name.strip():
        return jsonify({
            "status": "error",
            "message": "Teacher name is required"
        }), 400

    # Validate subjects
    if (
        not isinstance(subjects, list)
        or len(subjects) == 0
        or not all(
            isinstance(subject, str) and subject.strip()
            for subject in subjects
        )
    ):
        return jsonify({
            "status": "error",
            "message": "At least one valid subject is required"
        }), 400

    teacher = {
        "id": str(uuid.uuid4()),
        "name": name.strip(),
        "subjects": [subject.strip() for subject in subjects],
        "active": True
    }

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO teachers (id, name, subjects, active)
            VALUES (?, ?, ?, ?)
            """,
            (
                teacher["id"],
                teacher["name"],
                json.dumps(teacher["subjects"]),
                1
            )
        )

    return jsonify(teacher), 201


@app.get("/api/academic-year")
def academic_year_status():
    with get_connection() as conn:
        state = conn.execute("SELECT year, start_date FROM academic_year_state WHERE singleton=1").fetchone()
        count = conn.execute("SELECT COUNT(*) AS total FROM timetables").fetchone()["total"]
        free_count = conn.execute("SELECT COUNT(*) AS total FROM timetable_progress").fetchone()["total"]
        archived = conn.execute("SELECT COUNT(DISTINCT academic_year) AS total FROM timetable_archives").fetchone()["total"]
    return jsonify({"year": state["year"], "startDate": state["start_date"],
                    "timetableCount": count, "progressCount": free_count, "archivedYears": archived})


@app.post("/api/academic-year/rollover")
def rollover_academic_year():
    # LOCAL DEVELOPMENT ONLY. Before network deployment, require authenticated admin role.
    if request.remote_addr not in ("127.0.0.1", "::1"):
        return jsonify({"message": "Local access only; admin authentication is required for deployment."}), 403
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"message": "Invalid request."}), 400
    year, start = payload.get("newYear"), payload.get("startDate")
    if type(year) is not int or not 2000 <= year <= 2200:
        return jsonify({"message": "Enter a valid new academic year."}), 400
    try:
        start_day = date.fromisoformat(start)
        if start_day.isoformat() != start:
            raise ValueError()
    except (TypeError, ValueError):
        return jsonify({"message": "Enter a valid start date (YYYY-MM-DD)."}), 400
    if start_day < date.today():
        return jsonify({"message": "Start date cannot be in the past."}), 400
    if payload.get("confirmation") != f"RESET {year}":
        return jsonify({"message": f"Type RESET {year} to confirm."}), 400
    # Create a durable SQLite snapshot before any destructive operation.
    # The reset is aborted if a backup cannot be written.
    try:
        from pathlib import Path
        from datetime import datetime
        backup_dir = Path(__file__).resolve().parent / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup_path = backup_dir / f"before-rollover-{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}.db"
        with get_connection() as source, sqlite3.connect(backup_path) as target:
            source.backup(target)
    except (OSError, sqlite3.Error):
        app.logger.exception("Could not create rollover backup")
        return jsonify({"message": "Backup failed; no timetables were cleared."}), 500
    try:
        with get_connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            state = conn.execute("SELECT year, start_date FROM academic_year_state WHERE singleton=1").fetchone()
            if year <= state["year"] or start <= state["start_date"]:
                return jsonify({"message": "New year and start date must be later than the current ones."}), 409
            # Historical assignments must belong to the old period, not the upcoming year.
            if conn.execute("SELECT 1 FROM relief_assignments WHERE date >= ? LIMIT 1", (start,)).fetchone():
                return jsonify({"message": "Relief assignments exist on or after the new start date. Choose a later start date."}), 409
            conn.execute("""INSERT INTO timetable_archives
                (archive_id, academic_year, entry_id, teacher_id, class_name, subject, day, period)
                SELECT lower(hex(randomblob(16))), ?, id, teacher_id, class_name, subject, day, period
                FROM timetables""", (state["year"],))
            conn.execute("""INSERT INTO timetable_progress_archives
                (academic_year, teacher_id, day, period, status)
                SELECT ?, teacher_id, day, period, status FROM timetable_progress""", (state["year"],))
            conn.execute("DELETE FROM timetable_progress")
            conn.execute("DELETE FROM timetables")
            conn.execute("UPDATE academic_year_state SET year=?, start_date=? WHERE singleton=1", (year, start))
    except sqlite3.Error:
        app.logger.exception("Academic year rollover failed")
        return jsonify({"message": "Rollover failed; no changes committed."}), 500
    return jsonify({"message": "Timetables archived and reset. Relief history preserved.", "year": year, "backupFile": str(backup_path.name)})


@app.get("/api/timetables")
def get_timetables():
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT
                id,
                teacher_id,
                class_name,
                subject,
                day,
                period
            FROM timetables
            ORDER BY day, period, class_name
        """).fetchall()

    timetables = []

    for row in rows:
        timetables.append({
            "id": row["id"],
            "teacherId": row["teacher_id"],
            "className": row["class_name"],
            "subject": row["subject"],
            "day": row["day"],
            "period": row["period"]
        })

    return jsonify(timetables), 200


@app.get("/api/timetable-progress/<teacher_id>")
def get_timetable_progress(teacher_id):
    with get_connection() as connection:
        teacher = connection.execute(
            "SELECT id FROM teachers WHERE id = ?",
            (teacher_id,)
        ).fetchone()

        if teacher is None:
            return jsonify({
                "message": "Teacher not found"
            }), 404

        rows = connection.execute("""
            SELECT day, period, status
            FROM timetable_progress
            WHERE teacher_id = ?
              AND NOT EXISTS (
                SELECT 1 FROM timetables t
                WHERE t.teacher_id = timetable_progress.teacher_id
                  AND t.day = timetable_progress.day
                  AND t.period = timetable_progress.period
              )
            UNION ALL
            SELECT day, period, 'LESSON' AS status
            FROM timetables WHERE teacher_id = ?
        """, (teacher_id, teacher_id)).fetchall()

        progress = [
            {
                "day": row["day"],
                "period": row["period"],
                "status": row["status"]
            }
            for row in rows
        ]

    return jsonify(progress), 200


@app.put("/api/timetable-progress/free")
def save_free_period():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "message": "A valid JSON object is required"
        }), 400

    teacher_id = data.get("teacherId")
    day = data.get("day")
    period = data.get("period")

    if not isinstance(teacher_id, str) or not teacher_id.strip():
        return jsonify({"message": "Teacher is required"}), 400

    if day not in {
        "Monday", "Tuesday", "Wednesday",
        "Thursday", "Friday"
    }:
        return jsonify({"message": "Invalid school day"}), 400

    if type(period) is not int or not 1 <= period <= 8:
        return jsonify({
            "message": "Period must be between 1 and 8"
        }), 400

    teacher_id = teacher_id.strip()

    with get_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")

        teacher = connection.execute("""
            SELECT id, active
            FROM teachers
            WHERE id = ?
        """, (teacher_id,)).fetchone()

        if teacher is None:
            return jsonify({"message": "Teacher not found"}), 404

        if not teacher["active"]:
            return jsonify({
                "message": "Teacher is inactive"
            }), 409

        existing_lesson = connection.execute("""
            SELECT id
            FROM timetables
            WHERE teacher_id = ?
              AND day = ?
              AND period = ?
        """, (teacher_id, day, period)).fetchone()

        if existing_lesson:
            return jsonify({
                "message": "This period already has a lesson. Edit the lesson before marking it free."
            }), 409

        connection.execute("""
            INSERT INTO timetable_progress
                (teacher_id, day, period, status)
            VALUES (?, ?, ?, 'FREE')
            ON CONFLICT(teacher_id, day, period)
            DO UPDATE SET status = 'FREE'
        """, (teacher_id, day, period))

    return jsonify({
        "teacherId": teacher_id,
        "day": day,
        "period": period,
        "status": "FREE",
        "message": "Free period saved successfully"
    }), 200



@app.post("/api/timetables")
def create_timetable():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "message": "A valid JSON object is required"
        }), 400

    teacher_id = data.get("teacherId")
    class_name = data.get("className")
    subject = data.get("subject")
    day = data.get("day")
    period = data.get("period")

    if not isinstance(teacher_id, str) or not teacher_id.strip():
        return jsonify({"message": "Teacher is required"}), 400

    if not isinstance(class_name, str) or not class_name.strip():
        return jsonify({"message": "Class is required"}), 400

    if not isinstance(subject, str) or not subject.strip():
        return jsonify({"message": "Subject is required"}), 400

    valid_days = {
        "Monday", "Tuesday", "Wednesday",
        "Thursday", "Friday"
    }

    if day not in valid_days:
        return jsonify({"message": "Invalid school day"}), 400

    if type(period) is not int or not 1 <= period <= 8:
        return jsonify({
            "message": "Period must be between 1 and 8"
        }), 400

    teacher_id = teacher_id.strip()
    class_name = class_name.strip()
    subject = subject.strip()

    with get_connection() as connection:
        teacher = connection.execute(
            "SELECT id, active, subjects FROM teachers WHERE id = ?",
            (teacher_id,)
        ).fetchone()

        if teacher is None:
            return jsonify({"message": "Teacher not found"}), 404

        if not teacher["active"]:
            return jsonify({
                "message": "Inactive teachers cannot be assigned"
            }), 409

        if subject not in json.loads(teacher["subjects"]):
            return jsonify({
                "message": "Teacher does not teach this subject"
            }), 409

        class_conflict = connection.execute(
            """
            SELECT id FROM timetables
            WHERE day = ? AND period = ? AND class_name = ?
            """,
            (day, period, class_name)
        ).fetchone()

        if class_conflict:
            return jsonify({
                "message": "This class already has a lesson in that period"
            }), 409

        teacher_conflict = connection.execute(
            """
            SELECT id FROM timetables
            WHERE day = ? AND period = ? AND teacher_id = ?
            """,
            (day, period, teacher_id)
        ).fetchone()

        if teacher_conflict:
            return jsonify({
                "message": "Teacher is already assigned to another class"
            }), 409

        timetable = {
            "id": str(uuid.uuid4()),
            "teacherId": teacher_id,
            "className": class_name,
            "subject": subject,
            "day": day,
            "period": period
        }

        connection.execute(
            """
            INSERT INTO timetables
                (id, teacher_id, class_name, subject, day, period)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                timetable["id"],
                teacher_id,
                class_name,
                subject,
                day,
                period
            )
        )

        
        # Mark this period as completed in the wizard.
        connection.execute("""
            INSERT INTO timetable_progress
                (teacher_id, day, period, status)
            VALUES (?, ?, ?, 'LESSON')
            ON CONFLICT(teacher_id, day, period)
            DO UPDATE SET status = 'LESSON'
        """, (teacher_id, day, period))


    return jsonify(timetable), 201




@app.put("/api/timetable-period")
def update_timetable_period():
    """Atomically change one teacher's period between FREE and LESSON."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "A valid JSON object is required"}), 400

    teacher_id, day, period = data.get("teacherId"), data.get("day"), data.get("period")
    status = data.get("status")
    if not isinstance(teacher_id, str) or not teacher_id.strip():
        return jsonify({"message": "Teacher is required"}), 400
    teacher_id = teacher_id.strip()
    if day not in ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday"):
        return jsonify({"message": "Invalid school day"}), 400
    if type(period) is not int or not 1 <= period <= 8:
        return jsonify({"message": "Period must be between 1 and 8"}), 400
    if status not in ("FREE", "LESSON"):
        return jsonify({"message": "Status must be FREE or LESSON"}), 400

    class_name = data.get("className")
    subject = data.get("subject")
    if status == "LESSON":
        if not isinstance(class_name, str) or not class_name.strip():
            return jsonify({"message": "Class is required"}), 400
        if not isinstance(subject, str) or not subject.strip():
            return jsonify({"message": "Subject is required"}), 400
        class_name, subject = class_name.strip(), subject.strip()

    try:
        with get_connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            teacher = connection.execute(
                "SELECT active, subjects FROM teachers WHERE id = ?", (teacher_id,)
            ).fetchone()
            if teacher is None:
                return jsonify({"message": "Teacher not found"}), 404
            if not teacher["active"]:
                return jsonify({"message": "Teacher is inactive"}), 409
            if status == "LESSON" and subject not in json.loads(teacher["subjects"]):
                return jsonify({"message": "Teacher does not teach this subject"}), 409

            existing = connection.execute("""
                SELECT id, class_name, subject FROM timetables
                WHERE teacher_id = ? AND day = ? AND period = ?
            """, (teacher_id, day, period)).fetchone()

            # A relief assignment refers to this teacher's original lesson.
            # Do not alter its subject or class while assignments depend on it.
            if existing and (status == "FREE" or
                             existing["class_name"] != class_name or
                             existing["subject"] != subject):
                linked = connection.execute("""
                    SELECT 1 FROM relief_assignments
                    WHERE absent_teacher_id = ? AND period = ?
                      AND class_name = ? COLLATE NOCASE
                      AND subject = ?
                      AND CAST(strftime('%w', date) AS INTEGER) = ?
                    LIMIT 1
                """, (teacher_id, period, existing["class_name"],
                      existing["subject"],
                      ("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday").index(day))).fetchone()
                if linked:
                    return jsonify({"message": "Remove linked relief assignments before changing this lesson"}), 409

            if status == "LESSON":
                conflict = connection.execute("""
                    SELECT id FROM timetables
                    WHERE day = ? AND period = ?
                      AND class_name = ? COLLATE NOCASE
                      AND id != ?
                """, (day, period, class_name, existing["id"] if existing else "")).fetchone()
                if conflict:
                    return jsonify({"message": "This class already has a lesson in that period"}), 409

                # Existing relief teachers must remain free in their assigned periods.
                relief_conflict = connection.execute("""
                    SELECT 1 FROM relief_assignments
                    WHERE relief_teacher_id = ? AND period = ?
                      AND CAST(strftime('%w', date) AS INTEGER) = ?
                    LIMIT 1
                """, (teacher_id, period,
                      ("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday").index(day))).fetchone()
                if relief_conflict and existing is None:
                    return jsonify({"message": "Teacher has a relief assignment in this period"}), 409

                if existing:
                    entry_id = existing["id"]
                    connection.execute("""
                        UPDATE timetables SET class_name = ?, subject = ? WHERE id = ?
                    """, (class_name, subject, entry_id))
                else:
                    entry_id = str(uuid.uuid4())
                    connection.execute("""
                        INSERT INTO timetables
                            (id, teacher_id, class_name, subject, day, period)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (entry_id, teacher_id, class_name, subject, day, period))
                result = {"id": entry_id, "teacherId": teacher_id,
                          "className": class_name, "subject": subject,
                          "day": day, "period": period}
            else:
                if existing:
                    connection.execute("DELETE FROM timetables WHERE id = ?", (existing["id"],))
                result = None

            connection.execute("""
                INSERT INTO timetable_progress (teacher_id, day, period, status)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(teacher_id, day, period)
                DO UPDATE SET status = excluded.status
            """, (teacher_id, day, period, status))

        return jsonify({"message": "Period updated successfully", "status": status,
                        "entry": result}), 200
    except sqlite3.IntegrityError:
        return jsonify({"message": "Timetable conflicts with an existing lesson"}), 409


@app.put("/api/teachers/<teacher_id>")
def update_teacher(teacher_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "A valid JSON object is required"
        }), 400

    name = data.get("name")
    subjects = data.get("subjects")

    if not isinstance(name, str) or not name.strip():
        return jsonify({
            "status": "error",
            "message": "Teacher name is required"
        }), 400

    if (
        not isinstance(subjects, list)
        or len(subjects) == 0
        or not all(
            isinstance(subject, str) and subject.strip()
            for subject in subjects
        )
    ):
        return jsonify({
            "status": "error",
            "message": "At least one valid subject is required"
        }), 400

    clean_name = name.strip()
    clean_subjects = [
        subject.strip() for subject in subjects
    ]

    with get_connection() as connection:
        existing = connection.execute(
            "SELECT id, active FROM teachers WHERE id = ?",
            (teacher_id,)
        ).fetchone()

        if existing is None:
            return jsonify({
                "status": "error",
                "message": "Teacher not found"
            }), 404

        connection.execute(
            """
            UPDATE teachers
            SET name = ?, subjects = ?
            WHERE id = ?
            """,
            (
                clean_name,
                json.dumps(clean_subjects),
                teacher_id
            )
        )

    return jsonify({
        "id": teacher_id,
        "name": clean_name,
        "subjects": clean_subjects,
        "active": bool(existing["active"])
    }), 200


@app.patch("/api/teachers/<teacher_id>/status")
def update_teacher_status(teacher_id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or type(data.get("active")) is not bool:
        return jsonify({"message": "Active must be true or false"}), 400

    active = data["active"]
    with get_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        teacher = connection.execute(
            "SELECT id, name, subjects, active FROM teachers WHERE id = ?",
            (teacher_id,)
        ).fetchone()
        if teacher is None:
            return jsonify({"message": "Teacher not found"}), 404

        if not active:
            timetable = connection.execute(
                "SELECT 1 FROM timetables WHERE teacher_id = ? LIMIT 1",
                (teacher_id,)
            ).fetchone()
            relief = connection.execute("""
                SELECT 1 FROM relief_assignments
                WHERE absent_teacher_id = ? OR relief_teacher_id = ?
                LIMIT 1
            """, (teacher_id, teacher_id)).fetchone()
            if timetable or relief:
                return jsonify({
                    "message": "Remove the teacher's timetable and relief assignments before deactivating."
                }), 409

        connection.execute(
            "UPDATE teachers SET active = ? WHERE id = ?",
            (int(active), teacher_id)
        )

    return jsonify({
        "id": teacher["id"],
        "name": teacher["name"],
        "subjects": json.loads(teacher["subjects"]),
        "active": active
    }), 200


@app.delete("/api/teachers/<teacher_id>")
def delete_teacher(teacher_id):
    with get_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        teacher = connection.execute(
            "SELECT id FROM teachers WHERE id = ?", (teacher_id,)
        ).fetchone()
        if teacher is None:
            return jsonify({"message": "Teacher not found"}), 404

        dependencies = (
            ("timetable entries", "SELECT 1 FROM timetables WHERE teacher_id = ? LIMIT 1", (teacher_id,)),
            ("absence records", "SELECT 1 FROM absences WHERE teacher_id = ? LIMIT 1", (teacher_id,)),
            ("relief assignments", """SELECT 1 FROM relief_assignments
                WHERE absent_teacher_id = ? OR relief_teacher_id = ? LIMIT 1""", (teacher_id, teacher_id)),
        )
        for label, sql, params in dependencies:
            if connection.execute(sql, params).fetchone():
                return jsonify({
                    "message": f"Cannot delete teacher with linked {label}. Remove those records first."
                }), 409

        try:
            connection.execute("DELETE FROM teachers WHERE id = ?", (teacher_id,))
        except sqlite3.IntegrityError:
            return jsonify({"message": "Teacher has linked records and cannot be deleted."}), 409

    return jsonify({"message": "Teacher deleted successfully"}), 200


@app.post("/api/teachers/import")
def import_teacher_records():
    # This endpoint is for local development only.
    if request.remote_addr not in ("127.0.0.1", "::1"):
        return jsonify({
            "status": "error",
            "message": "Import is only available locally"
        }), 403

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "Expected a JSON object"
        }), 400

    teachers = data.get("teachers")

    try:
        imported_count = import_teachers(teachers)

        return jsonify({
            "status": "success",
            "message": "Teachers imported successfully",
            "imported": imported_count
        }), 201

    except ValueError as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 400


@app.route("/api/absences", methods=["GET"])
def get_absences():
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT
                id,
                teacher_id,
                date,
                reason
            FROM absences
            ORDER BY date DESC, teacher_id
        """).fetchall()

    return jsonify([
        {
            "id": row["id"],
            "teacherId": row["teacher_id"],
            "date": row["date"],
            "reason": row["reason"]
        }
        for row in rows
    ])


@app.route("/api/absences", methods=["POST"])
def create_absence():
    from datetime import date
    import sqlite3
    import uuid

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON request."}), 400

    teacher_id = data.get("teacherId")
    absence_date = data.get("date")
    reason = data.get("reason", "")

    if not isinstance(teacher_id, str) or not teacher_id.strip():
        return jsonify({"error": "Teacher is required."}), 400

    if not isinstance(absence_date, str):
        return jsonify({"error": "Valid absence date is required."}), 400

    if not isinstance(reason, str):
        return jsonify({"error": "Reason must be text."}), 400

    try:
        parsed_date = date.fromisoformat(absence_date)

        if parsed_date.isoformat() != absence_date:
            raise ValueError()

    except ValueError:
        return jsonify({"error": "Date must be YYYY-MM-DD."}), 400

    teacher_id = teacher_id.strip()
    reason = reason.strip()

    with get_connection() as connection:
        teacher = connection.execute(
            "SELECT id, active FROM teachers WHERE id = ?",
            (teacher_id,)
        ).fetchone()

        if teacher is None or not teacher["active"]:
            return jsonify({
                "error": "Please select an active teacher."
            }), 400

        absence_id = str(uuid.uuid4())

        try:
            connection.execute(
                """
                INSERT INTO absences (id, teacher_id, date, reason)
                VALUES (?, ?, ?, ?)
                """,
                (absence_id, teacher_id, absence_date, reason)
            )

        except sqlite3.IntegrityError:
            return jsonify({
                "error": "This teacher is already marked absent on this date."
            }), 409

    return jsonify({
        "id": absence_id,
        "teacherId": teacher_id,
        "date": absence_date,
        "reason": reason
    }), 201


@app.route("/api/relief-assignments", methods=["GET"])
def get_relief_assignments():
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT
                id,
                date,
                period,
                class_name,
                absent_teacher_id,
                relief_teacher_id,
                subject
            FROM relief_assignments
            ORDER BY date DESC, period ASC, class_name ASC
        """).fetchall()

    assignments = [
        {
            "id": row["id"],
            "date": row["date"],
            "period": row["period"],
            "className": row["class_name"],
            "absentTeacherId": row["absent_teacher_id"],
            "reliefTeacherId": row["relief_teacher_id"],
            "subject": row["subject"]
        }
        for row in rows
    ]

    return jsonify(assignments), 200


@app.post("/api/relief-assignments")
def create_relief_assignment():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"message": "A valid JSON object is required"}), 400

    assignment_date = data.get("date")
    period = data.get("period")
    class_name = data.get("className")
    absent_teacher_id = data.get("absentTeacherId")
    relief_teacher_id = data.get("reliefTeacherId")
    subject = data.get("subject")

    if not isinstance(assignment_date, str):
        return jsonify({"message": "Valid date is required"}), 400

    try:
        parsed_date = date.fromisoformat(assignment_date)
        if parsed_date.isoformat() != assignment_date:
            raise ValueError
    except ValueError:
        return jsonify({"message": "Date must be YYYY-MM-DD"}), 400

    day_name = parsed_date.strftime("%A")

    if day_name not in {
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"
    }:
        return jsonify({"message": "Relief is only available on school days"}), 400

    if type(period) is not int or not 1 <= period <= 8:
        return jsonify({"message": "Period must be between 1 and 8"}), 400

    for field_name, value in {
        "Class": class_name,
        "Absent teacher": absent_teacher_id,
        "Relief teacher": relief_teacher_id,
        "Subject": subject
    }.items():
        if not isinstance(value, str) or not value.strip():
            return jsonify({"message": f"{field_name} is required"}), 400

    class_name = class_name.strip()
    absent_teacher_id = absent_teacher_id.strip()
    relief_teacher_id = relief_teacher_id.strip()
    subject = subject.strip()

    if absent_teacher_id == relief_teacher_id:
        return jsonify({
            "message": "A teacher cannot substitute for themselves"
        }), 409

    assignment = {
        "id": str(uuid.uuid4()),
        "date": assignment_date,
        "period": period,
        "className": class_name,
        "absentTeacherId": absent_teacher_id,
        "reliefTeacherId": relief_teacher_id,
        "subject": subject
    }

    try:
        with get_connection() as connection:
            # Reserve the SQLite write transaction before validating.
            connection.execute("BEGIN IMMEDIATE")

            lesson = connection.execute("""
                SELECT id
                FROM timetables
                WHERE day = ?
                  AND period = ?
                  AND class_name = ? COLLATE NOCASE
                  AND teacher_id = ?
                  AND subject = ?
            """, (
                day_name, period, class_name,
                absent_teacher_id, subject
            )).fetchone()

            if lesson is None:
                return jsonify({
                    "message": "The original timetable lesson does not exist"
                }), 409

            absence = connection.execute("""
                SELECT id FROM absences
                WHERE teacher_id = ? AND date = ?
            """, (absent_teacher_id, assignment_date)).fetchone()

            if absence is None:
                return jsonify({
                    "message": "The original teacher is not marked absent"
                }), 409

            relief_teacher = connection.execute("""
                SELECT id, active FROM teachers WHERE id = ?
            """, (relief_teacher_id,)).fetchone()

            if relief_teacher is None or not relief_teacher["active"]:
                return jsonify({
                    "message": "The relief teacher does not exist or is inactive"
                }), 409

            relief_absence = connection.execute("""
                SELECT id FROM absences
                WHERE teacher_id = ? AND date = ?
            """, (relief_teacher_id, assignment_date)).fetchone()

            if relief_absence:
                return jsonify({
                    "message": "The relief teacher is absent on this date"
                }), 409

            teaching_conflict = connection.execute("""
                SELECT id FROM timetables
                WHERE teacher_id = ? AND day = ? AND period = ?
            """, (relief_teacher_id, day_name, period)).fetchone()

            if teaching_conflict:
                return jsonify({
                    "message": "The relief teacher already has a lesson"
                }), 409

            relief_conflict = connection.execute("""
                SELECT id FROM relief_assignments
                WHERE relief_teacher_id = ? AND date = ? AND period = ?
            """, (
                relief_teacher_id, assignment_date, period
            )).fetchone()

            if relief_conflict:
                return jsonify({
                    "message": "The relief teacher is already assigned relief"
                }), 409

            class_conflict = connection.execute("""
                SELECT id FROM relief_assignments
                WHERE date = ? AND period = ?
                  AND class_name = ? COLLATE NOCASE
            """, (assignment_date, period, class_name)).fetchone()

            if class_conflict:
                return jsonify({
                    "message": "This lesson already has a relief assignment"
                }), 409

            connection.execute("""
                INSERT INTO relief_assignments (
                    id, date, period, class_name,
                    absent_teacher_id, relief_teacher_id, subject
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                assignment["id"],
                assignment_date,
                period,
                class_name,
                absent_teacher_id,
                relief_teacher_id,
                subject
            ))

    except sqlite3.IntegrityError:
        return jsonify({
            "message": "Assignment conflicts with an existing database record"
        }), 409

    return jsonify(assignment), 201


@app.delete("/api/relief-assignments/<assignment_id>")
def delete_relief_assignment(assignment_id):
    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM relief_assignments WHERE id = ?",
            (assignment_id,)
        )

        if cursor.rowcount == 0:
            return jsonify({
                "message": "Relief assignment not found"
            }), 404

    return jsonify({
        "message": "Relief assignment removed successfully"
    }), 200


@app.delete("/api/absences/<absence_id>")
def delete_absence(absence_id):
    with get_connection() as check_conn:
        year_start = check_conn.execute("SELECT start_date FROM academic_year_state WHERE singleton=1").fetchone()["start_date"]
    if assignment_date < year_start:
        return jsonify({"message": "Cannot create relief for a date before the current academic year."}), 409

    with get_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")

        absence = connection.execute(
            "SELECT teacher_id, date FROM absences WHERE id = ?",
            (absence_id,)
        ).fetchone()

        if absence is None:
            return jsonify({"message": "Absence not found"}), 404

        related = connection.execute("""
            SELECT id FROM relief_assignments
            WHERE absent_teacher_id = ? AND date = ?
        """, (absence["teacher_id"], absence["date"])).fetchone()

        if related:
            return jsonify({
                "message": "Remove this teacher's relief assignments first."
            }), 409

        connection.execute(
            "DELETE FROM absences WHERE id = ?",
            (absence_id,)
        )

    return jsonify({"message": "Absence removed successfully"}), 200


@app.delete("/api/timetables/<entry_id>")
def delete_timetable(entry_id):
    with get_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")

        entry = connection.execute("""
            SELECT teacher_id, class_name, day, period
            FROM timetables WHERE id = ?
        """, (entry_id,)).fetchone()

        if entry is None:
            return jsonify({"message": "Timetable entry not found"}), 404

        assignments = connection.execute("""
            SELECT date FROM relief_assignments
            WHERE absent_teacher_id = ?
              AND class_name = ? COLLATE NOCASE
              AND period = ?
        """, (
            entry["teacher_id"],
            entry["class_name"],
            entry["period"]
        )).fetchall()

        for assignment in assignments:
            assignment_day = date.fromisoformat(
                assignment["date"]
            ).strftime("%A")

            if assignment_day == entry["day"]:
                return jsonify({
                    "message": "Remove linked relief assignments first."
                }), 409

        connection.execute(
            "DELETE FROM timetables WHERE id = ?",
            (entry_id,)
        )
        connection.execute("""
            DELETE FROM timetable_progress
            WHERE teacher_id = ? AND day = ? AND period = ?
        """, (entry["teacher_id"], entry["day"], entry["period"]))

    return jsonify({"message": "Timetable entry removed successfully"}), 200


@app.get("/api/backup/sqlite")
def download_sqlite_backup():
    # Development-only endpoint. Production use requires administrator authentication.
    if request.remote_addr not in ("127.0.0.1", "::1"):
        return jsonify({"message": "Local access only"}), 403

    temporary_path = None
    try:
        # SQLite's backup API produces a consistent snapshot, even if WAL is enabled.
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as temporary:
            temporary_path = temporary.name

        with get_connection() as source:
            with sqlite3.connect(temporary_path) as destination:
                source.backup(destination)

        with open(temporary_path, "rb") as snapshot:
            backup_bytes = snapshot.read()

        return send_file(
            BytesIO(backup_bytes),
            mimetype="application/vnd.sqlite3",
            as_attachment=True,
            download_name=f"reliefms-backup-{date.today().isoformat()}.db",
            max_age=0,
        )
    except (sqlite3.Error, OSError):
        app.logger.exception("Failed to create SQLite backup")
        return jsonify({"message": "Could not create database backup"}), 500
    finally:
        if temporary_path is not None:
            try:
                os.unlink(temporary_path)
            except OSError:
                app.logger.warning("Could not remove temporary backup file")


# School grade and division management
@app.get("/api/grades")
def list_grades():
    with get_connection() as conn:
        grades = conn.execute("SELECT id, name FROM grades ORDER BY name COLLATE NOCASE").fetchall()
        classes = conn.execute("""SELECT c.id, c.grade_id, c.section, g.name AS grade_name
            FROM school_classes c JOIN grades g ON g.id = c.grade_id
            ORDER BY g.name COLLATE NOCASE, c.section COLLATE NOCASE""").fetchall()
    return jsonify({"grades": [dict(r) for r in grades],
                    "classes": [{"id":r["id"], "gradeId":r["grade_id"],
                                 "section":r["section"], "name":f'{r["grade_name"]}{r["section"]}'} for r in classes]})

@app.post("/api/grades")
def add_grade():
    data = request.get_json(silent=True) or {}
    name = data.get("name", "")
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 60:
        return jsonify({"message":"Enter a valid grade name (maximum 60 characters)."}), 400
    name = name.strip()
    row_id = str(uuid.uuid4())
    try:
        with get_connection() as conn:
            conn.execute("INSERT INTO grades (id, name) VALUES (?, ?)", (row_id, name))
    except sqlite3.IntegrityError:
        return jsonify({"message":"This grade already exists."}), 409
    return jsonify({"id":row_id,"name":name}), 201

@app.post("/api/school-classes")
def add_school_class():
    data = request.get_json(silent=True) or {}
    grade_id, section = data.get("gradeId"), data.get("section")
    if not isinstance(grade_id, str) or not isinstance(section, str) or not section.strip() or len(section.strip()) > 20:
        return jsonify({"message":"Select a grade and enter a valid division (maximum 20 characters)."}), 400
    section = section.strip().upper()
    row_id = str(uuid.uuid4())
    with get_connection() as conn:
        grade = conn.execute("SELECT name FROM grades WHERE id=?", (grade_id,)).fetchone()
        if not grade:
            return jsonify({"message":"Grade not found."}), 404
        try:
            conn.execute("INSERT INTO school_classes (id, grade_id, section) VALUES (?,?,?)", (row_id, grade_id, section))
        except sqlite3.IntegrityError:
            return jsonify({"message":"This class already exists in the grade."}), 409
    return jsonify({"id":row_id,"gradeId":grade_id,"section":section,"name":grade["name"]+section}), 201

@app.delete("/api/school-classes/<class_id>")
def remove_school_class(class_id):
    with get_connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        item = conn.execute("""SELECT c.id, c.section, g.name AS grade_name
            FROM school_classes c JOIN grades g ON g.id=c.grade_id WHERE c.id=?""", (class_id,)).fetchone()
        if not item:
            return jsonify({"message":"Class not found."}), 404
        name = item["grade_name"] + item["section"]
        for table in ("timetables", "relief_assignments", "timetable_archives"):
            used = conn.execute(f"SELECT 1 FROM {table} WHERE class_name = ? COLLATE NOCASE LIMIT 1", (name,)).fetchone()
            if used:
                return jsonify({"message":"This class is used in existing lessons or relief assignments."}), 409
        conn.execute("DELETE FROM school_classes WHERE id=?", (class_id,))
    return jsonify({"message":"Class deleted."})

@app.delete("/api/grades/<grade_id>")
def remove_grade(grade_id):
    with get_connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        grade = conn.execute("SELECT name FROM grades WHERE id=?", (grade_id,)).fetchone()
        if not grade:
            return jsonify({"message":"Grade not found."}), 404
        if conn.execute("SELECT 1 FROM school_classes WHERE grade_id=? LIMIT 1", (grade_id,)).fetchone():
            return jsonify({"message":"Remove this grade's classes first."}), 409
        conn.execute("DELETE FROM grades WHERE id=?", (grade_id,))
    return jsonify({"message":"Grade deleted."})


# ---------------------------------------------
# CLOUD ACADEMIC YEAR MANAGEMENT
# ---------------------------------------------

def archive_cloud_table(cursor, source, archive, school_id, year):
    """
    Archive rows belonging to one school.

    Copies columns shared by the source and archive tables,
    and supplies academic_year and archive_id where required.
    """

    cursor.execute(
        """
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN (%s, %s)
        ORDER BY ordinal_position
        """,
        (source, archive)
    )

    columns = {}

    for row in cursor.fetchall():
        columns.setdefault(row["table_name"], []).append(
            row["column_name"]
        )

    source_columns = set(columns.get(source, []))
    archive_columns = columns.get(archive, [])

    if "school_id" not in source_columns:
        raise ValueError("Source table has no school_id")

    if "academic_year" not in archive_columns:
        raise ValueError("Archive table has no academic_year")

    insert_columns = []
    select_expressions = []
    parameters = []

    for column in archive_columns:
        if column == "academic_year":
            insert_columns.append(sql.Identifier(column))
            select_expressions.append(sql.Placeholder())
            parameters.append(year)

        elif column == "archive_id" and column not in source_columns:
            insert_columns.append(sql.Identifier(column))
            select_expressions.append(
                sql.SQL("md5(random()::text || clock_timestamp()::text)")
            )

        elif column in source_columns:
            insert_columns.append(sql.Identifier(column))
            select_expressions.append(sql.Identifier(column))

    query = sql.SQL("""
        INSERT INTO {archive} ({columns})
        SELECT {expressions}
        FROM {source}
        WHERE school_id = %s
    """).format(
        archive=sql.Identifier(archive),
        columns=sql.SQL(", ").join(insert_columns),
        expressions=sql.SQL(", ").join(select_expressions),
        source=sql.Identifier(source)
    )

    parameters.append(school_id)
    cursor.execute(query, parameters)


@app.get("/api/cloud/academic-year")
@require_school_admin
def get_cloud_academic_year():
    with get_postgres_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT year, start_date
                FROM academic_year_state
                WHERE school_id = %s
                """,
                (g.school_id,)
            )

            state = cursor.fetchone()

            cursor.execute(
                """
                SELECT COUNT(*) AS count
                FROM timetables
                WHERE school_id = %s
                """,
                (g.school_id,)
            )

            timetable_count = cursor.fetchone()["count"]

            cursor.execute(
                """
                SELECT COUNT(*) AS count
                FROM timetable_progress
                WHERE school_id = %s
                """,
                (g.school_id,)
            )

            progress_count = cursor.fetchone()["count"]

    if state is None:
        return jsonify({
            "message": "Academic year is not configured."
        }), 404

    return jsonify({
        "year": state["year"],
        "startDate": state["start_date"],
        "timetableCount": timetable_count,
        "progressCount": progress_count
    })


@app.post("/api/cloud/academic-year/rollover")
@require_school_admin
def rollover_cloud_academic_year():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"message": "Invalid request body."}), 400

    new_year = data.get("newYear")
    start_date = data.get("startDate")
    confirmation = data.get("confirmation")

    if type(new_year) is not int or not 2000 <= new_year <= 2200:
        return jsonify({"message": "Invalid academic year."}), 400

    if confirmation != f"RESET {new_year}":
        return jsonify({"message": "Invalid confirmation."}), 400

    try:
        parsed_date = date.fromisoformat(start_date)

        if parsed_date.year != new_year:
            raise ValueError()

    except (TypeError, ValueError):
        return jsonify({"message": "Invalid start date."}), 400

    try:
        with get_postgres_connection() as connection:
            with connection.transaction():
                with connection.cursor() as cursor:

                    cursor.execute(
                        """
                        SELECT year
                        FROM academic_year_state
                        WHERE school_id = %s
                        FOR UPDATE
                        """,
                        (g.school_id,)
                    )

                    current = cursor.fetchone()

                    if current is None:
                        return jsonify({
                            "message": "Academic year not configured."
                        }), 404

                    old_year = current["year"]

                    if new_year != old_year + 1:
                        return jsonify({
                            "message": "New year must be the next academic year."
                        }), 400

                    archive_cloud_table(
                        cursor,
                        "timetables",
                        "timetable_archives",
                        g.school_id,
                        old_year
                    )

                    archive_cloud_table(
                        cursor,
                        "timetable_progress",
                        "timetable_progress_archives",
                        g.school_id,
                        old_year
                    )

                    cursor.execute(
                        """
                        DELETE FROM timetable_progress
                        WHERE school_id = %s
                        """,
                        (g.school_id,)
                    )

                    cursor.execute(
                        """
                        DELETE FROM timetables
                        WHERE school_id = %s
                        """,
                        (g.school_id,)
                    )

                    cursor.execute(
                        """
                        UPDATE academic_year_state
                        SET year = %s,
                            start_date = %s
                        WHERE school_id = %s
                        """,
                        (new_year, start_date, g.school_id)
                    )

        return jsonify({
            "message": "Academic year reset successfully.",
            "previousYear": old_year,
            "newYear": new_year
        })

    except Exception:
        app.logger.exception("Cloud academic year rollover failed")

        return jsonify({
            "message": "Academic year reset failed. No changes were committed."
        }), 500


# ---------------------------------------------
# CLOUD SCHOOL CONFIGURATION - SCHEMA CHECK
# ---------------------------------------------

@app.get("/api/cloud/configuration/schema")
@require_school_admin
def get_cloud_configuration_schema():
    with get_postgres_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    table_name,
                    column_name,
                    data_type,
                    is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name IN (
                      'grades',
                      'school_classes'
                  )
                ORDER BY table_name, ordinal_position
                """
            )

            rows = cursor.fetchall()

    return jsonify(rows)


# =============================================
# CLOUD GRADES AND CLASSES MANAGEMENT
# =============================================

@app.get("/api/cloud/configuration")
@require_school_admin
def get_cloud_configuration():
    with get_postgres_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, name
                FROM grades
                WHERE school_id = %s
                ORDER BY name
            """, (g.school_id,))
            grades = cursor.fetchall()

            cursor.execute("""
                SELECT id, grade_id, section
                FROM school_classes
                WHERE school_id = %s
                ORDER BY section
            """, (g.school_id,))
            classes = cursor.fetchall()

    return jsonify({
        "grades": grades,
        "classes": classes
    })


@app.post("/api/cloud/grades")
@require_school_admin
def create_cloud_grade():
    data = request.get_json(silent=True) or {}
    name = data.get("name")

    if not isinstance(name, str) or not name.strip():
        return jsonify({"message": "Grade name is required."}), 400

    name = name.strip()

    with get_postgres_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id FROM grades
                WHERE school_id = %s AND LOWER(name) = LOWER(%s)
            """, (g.school_id, name))

            if cursor.fetchone():
                return jsonify({"message": "Grade already exists."}), 409

            grade_id = str(uuid4())

            cursor.execute("""
                INSERT INTO grades (id, school_id, name)
                VALUES (%s, %s, %s)
            """, (grade_id, g.school_id, name))

        connection.commit()

    return jsonify({
        "id": grade_id,
        "name": name
    }), 201


@app.delete("/api/cloud/grades/<grade_id>")
@require_school_admin
def delete_cloud_grade(grade_id):
    with get_postgres_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id FROM school_classes
                WHERE school_id = %s AND grade_id = %s
                LIMIT 1
            """, (g.school_id, grade_id))

            if cursor.fetchone():
                return jsonify({
                    "message": "Delete the classes in this grade first."
                }), 409

            cursor.execute("""
                DELETE FROM grades
                WHERE id = %s AND school_id = %s
                RETURNING id
            """, (grade_id, g.school_id))

            deleted = cursor.fetchone()

        connection.commit()

    if not deleted:
        return jsonify({"message": "Grade not found."}), 404

    return jsonify({"message": "Grade deleted successfully."})


@app.post("/api/cloud/classes")
@require_school_admin
def create_cloud_class():
    data = request.get_json(silent=True) or {}
    grade_id = data.get("gradeId")
    section = data.get("section")

    if not isinstance(grade_id, str) or not grade_id.strip():
        return jsonify({"message": "Select a grade."}), 400

    if not isinstance(section, str) or not section.strip():
        return jsonify({"message": "Class division is required."}), 400

    section = section.strip()

    with get_postgres_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id FROM grades
                WHERE id = %s AND school_id = %s
            """, (grade_id, g.school_id))

            if not cursor.fetchone():
                return jsonify({"message": "Grade not found."}), 404

            cursor.execute("""
                SELECT id FROM school_classes
                WHERE school_id = %s
                  AND grade_id = %s
                  AND LOWER(section) = LOWER(%s)
            """, (g.school_id, grade_id, section))

            if cursor.fetchone():
                return jsonify({
                    "message": "This class already exists."
                }), 409

            class_id = str(uuid4())

            cursor.execute("""
                INSERT INTO school_classes (
                    id, school_id, grade_id, section
                )
                VALUES (%s, %s, %s, %s)
            """, (class_id, g.school_id, grade_id, section))

        connection.commit()

    return jsonify({
        "id": class_id,
        "grade_id": grade_id,
        "section": section
    }), 201


@app.delete("/api/cloud/classes/<class_id>")
@require_school_admin
def delete_cloud_class(class_id):
    with get_postgres_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                DELETE FROM school_classes
                WHERE id = %s AND school_id = %s
                RETURNING id
            """, (class_id, g.school_id))

            deleted = cursor.fetchone()

        connection.commit()

    if not deleted:
        return jsonify({"message": "Class not found."}), 404

    return jsonify({"message": "Class deleted successfully."})


if __name__ == "__main__":
    initialize_database()
    app.run(host="127.0.0.1", port=5000, debug=True)
