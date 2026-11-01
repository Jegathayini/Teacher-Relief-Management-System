from database import (initialize_database, import_teachers,get_connection)
from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import uuid
import sqlite3
from datetime import date

app = Flask(__name__)
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





@app.get("/api/teachers")
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

    return jsonify(timetable), 201


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

    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "A valid JSON object is required"
        }), 400

    active = data.get("active")

    if not isinstance(active, bool):
        return jsonify({
            "status": "error",
            "message": "Active must be true or false"
        }), 400

    with get_connection() as connection:
        teacher = connection.execute(
            """
            SELECT id, name, subjects, active
            FROM teachers
            WHERE id = ?
            """,
            (teacher_id,)
        ).fetchone()

        if teacher is None:
            return jsonify({
                "status": "error",
                "message": "Teacher not found"
            }), 404

        if not active:
            return jsonify({
                "status": "error",
                "message": (
                    "Deactivation is temporarily disabled "
                    "until relief assignments are stored "
                    "and checked in SQLite."
                )
            }), 409

        connection.execute(
            """
            UPDATE teachers
            SET active = 1
            WHERE id = ?
            """,
            (teacher_id,)
        )

    return jsonify({
        "id": teacher["id"],
        "name": teacher["name"],
        "subjects": json.loads(teacher["subjects"]),
        "active": True
    }), 200


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

    return jsonify({"message": "Timetable entry removed successfully"}), 200


if __name__ == "__main__":
    initialize_database()
    app.run(host="127.0.0.1", port=5000, debug=True)
