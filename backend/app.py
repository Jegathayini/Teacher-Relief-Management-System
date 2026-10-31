
from flask import Flask, jsonify
from flask_cors import CORS

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


# Temporary teacher data for API testing
sample_teachers = [
    {
        "id": "T001",
        "name": "Arun",
        "subjects": ["Mathematics"],
        "active": True
    },
    {
        "id": "T002",
        "name": "Priya",
        "subjects": ["Science"],
        "active": True
    },
    {
        "id": "T003",
        "name": "Nimal",
        "subjects": ["English"],
        "active": True
    }
]


@app.get("/api/teachers")
def get_teachers():
    return jsonify(sample_teachers)



if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
