from database import (initialize_database, import_teachers,get_connection)
from flask import Flask, jsonify, request
from flask_cors import CORS
import json
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
