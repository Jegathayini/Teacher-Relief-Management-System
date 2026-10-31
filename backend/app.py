from database import (initialize_database, import_teachers,get_connection)
from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import uuid
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



if __name__ == "__main__":
    initialize_database()
    app.run(host="127.0.0.1", port=5000, debug=True)
