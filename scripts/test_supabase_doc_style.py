import os

import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Fetch variables
DATABASE_URL = os.getenv("DATABASE_URL")

# Connect to the database
connection = psycopg2.connect(DATABASE_URL)

with connection.cursor() as cursor:
    cursor.execute("select 1")
    print("SELECT1 =", cursor.fetchone()[0])

connection.close()
