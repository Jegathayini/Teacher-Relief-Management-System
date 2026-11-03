
from functools import wraps

import requests
from flask import g, jsonify, request

from auth import verify_access_token
from school_access import get_admin_school


def require_school_admin(view_function):
    @wraps(view_function)
    def decorated(*args, **kwargs):
        authorization = request.headers.get(
            "Authorization", ""
        )

        scheme, separator, token = authorization.partition(" ")

        if (
            not separator
            or scheme.lower() != "bearer"
            or not token.strip()
        ):
            return jsonify({
                "message": "Authentication required"
            }), 401

        try:
            user = verify_access_token(token.strip())

        except ValueError:
            return jsonify({
                "message": "Invalid or expired access token"
            }), 401

        except requests.RequestException:
            return jsonify({
                "message": "Authentication service unavailable"
            }), 503

        try:
            school_id = get_admin_school(user["id"])

        except Exception:
            # Do not expose database errors to clients.
            return jsonify({
                "message": "Unable to verify school access"
            }), 503

        if school_id is None:
            return jsonify({
                "message": "No school administrator access"
            }), 403

        g.user_id = user["id"]
        g.school_id = school_id

        return view_function(*args, **kwargs)

    return decorated
