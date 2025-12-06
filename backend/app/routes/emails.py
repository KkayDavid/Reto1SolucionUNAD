from fastapi import APIRouter
import sqlite3
import os

router = APIRouter()

# Ruta correcta a la base de datos
DB_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "emails.db")
DB_FILE = os.path.abspath(DB_FILE)


@router.get("/")
def list_emails():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("""
        SELECT id, from_address, subject, body, received_at, radicado_in
        FROM emails
        ORDER BY received_at DESC
    """)

    rows = cur.fetchall()
    conn.close()

    return [dict(r) for r in rows]
