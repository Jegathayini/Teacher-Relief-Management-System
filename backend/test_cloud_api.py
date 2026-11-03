
import getpass
import os

import requests
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
publishable_key = os.environ["SUPABASE_PUBLISHABLE_KEY"]

email = input("Administrator email: ").strip()
password = getpass.getpass("Administrator password: ")

# Step 1: Sign in through Supabase.
login_response = requests.post(
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

if login_response.status_code != 200:
    print("Supabase sign-in failed.")
    print("HTTP status:", login_response.status_code)
    raise SystemExit(1)

access_token = login_response.json()["access_token"]

print("Supabase login successful!")

# Step 2: Call the real cloud endpoint.
api_response = requests.get(
    "http://127.0.0.1:5000/api/cloud/teachers",
    headers={
        "Authorization": f"Bearer {access_token}"
    },
    timeout=20,
)

print("Flask HTTP status:", api_response.status_code)

if api_response.status_code == 200:
    teachers = api_response.json()

    assert isinstance(teachers, list)

    for teacher in teachers:
        assert isinstance(teacher["subjects"], list)
        assert isinstance(teacher["active"], bool)

    print("Cloud teacher API successful!")
    print("Number of teachers:", len(teachers))
else:
    print("API response:", api_response.text)
