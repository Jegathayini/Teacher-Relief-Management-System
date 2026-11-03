
import getpass
import os

import requests
from dotenv import load_dotenv

from test_auth_middleware import app

load_dotenv()

supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
publishable_key = os.environ["SUPABASE_PUBLISHABLE_KEY"]

email = input("Administrator email: ").strip()
password = getpass.getpass("Administrator password: ")

response = requests.post(
    f"{supabase_url}/auth/v1/token",
    params={"grant_type": "password"},
    headers={
        "apikey": publishable_key,
        "Content-Type": "application/json",
    },
    json={
        "email": email,
        "password": password,
    },
    timeout=15,
)

if response.status_code != 200:
    print("Supabase sign-in failed.")
    print("HTTP status:", response.status_code)
    raise SystemExit(1)

access_token = response.json().get("access_token")

if not access_token:
    raise RuntimeError("No access token returned")

print("Supabase sign-in successful!")

with app.test_client() as client:
    result = client.get(
        "/api/test-admin",
        headers={
            "Authorization": f"Bearer {access_token}"
        },
    )

    print("Flask HTTP status:", result.status_code)

    if result.status_code == 200:
        data = result.get_json()
        print("Administrator authentication successful!")
        print("School access verified:", bool(data.get("schoolId")))
    else:
        print("Response:", result.get_json())
