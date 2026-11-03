
from flask import Flask, jsonify, g

from auth_middleware import require_school_admin

app = Flask(__name__)


@app.get("/api/test-admin")
@require_school_admin
def test_admin():
    return jsonify({
        "message": "Administrator authenticated",
        "userId": g.user_id,
        "schoolId": g.school_id,
    })


if __name__ == "__main__":
    with app.test_client() as client:
        response = client.get("/api/test-admin")

        print("HTTP status:", response.status_code)
        print("Response:", response.get_json())

        assert response.status_code == 401

    print("Unauthenticated request correctly rejected!")
