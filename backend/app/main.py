# backend/app/main.py
import os
import imaplib
import email
import smtplib
import sqlite3
import uuid
import time
import mimetypes
import threading
from email.message import EmailMessage
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, Request, BackgroundTasks, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# ---------------------------
# Config
# ---------------------------
BASE_DIR = os.path.dirname(__file__)
DB_FILE = os.path.join(BASE_DIR, "..", "emails.db")

IMAP_HOST = os.getenv("IMAP_HOST", "imap.gmail.com")
IMAP_USER = os.getenv("IMAP_USER", "")
IMAP_PASS = os.getenv("IMAP_PASS", "")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", IMAP_USER)
SMTP_PASS = os.getenv("SMTP_PASS", IMAP_PASS)

app = FastAPI(title="Correo Gestión - Backend")

app.add_middleware(
    CORSMiddleware,
   allow_origins=[
    "http://localhost:3000",
    "https://reto1-solucion-unad.vercel.app",
    "https://reto1-solucion-unad-7xtrc585d-kkaydavids-projects.vercel.app"
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# DB Init
# ---------------------------
def init_db():
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.executescript("""
CREATE TABLE IF NOT EXISTS radicados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prefix TEXT,
    year INTEGER,
    sequence INTEGER,
    generated_at TEXT
);

CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    from_address TEXT,
    to_addresses TEXT,
    subject TEXT,
    body TEXT,
    raw TEXT,
    received_at TEXT,
    status TEXT,
    radicado_in TEXT
);

CREATE TABLE IF NOT EXISTS auto_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT,
    to_address TEXT,
    subject TEXT,
    body TEXT,
    sent_at TEXT
);
""")
    conn.commit()
    conn.close()

init_db()

# ---------------------------
# Utils
# ---------------------------
def now_iso():
    return datetime.utcnow().isoformat()


class ReplyModel(BaseModel):
    to: str
    subject: str
    message: str

# ---------------------------
# Radicado
# ---------------------------
def generate_radicado(prefix="322"):
    year = datetime.utcnow().year

    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()

    cur.execute(
        "SELECT sequence FROM radicados WHERE prefix=? AND year=? ORDER BY sequence DESC LIMIT 1",
        (prefix, year)
    )

    r = cur.fetchone()
    seq = 1 if r is None else r[0] + 1

    cur.execute(
        "INSERT INTO radicados(prefix, year, sequence, generated_at) VALUES(?,?,?,?)",
        (prefix, year, seq, now_iso())
    )

    conn.commit()
    conn.close()

    return f"{prefix}-{seq:05d}-{str(year)[-2:]}"

# ---------------------------
# Save inbound
# ---------------------------
def save_email(payload: dict):
    eid = str(uuid.uuid4())
    rad = generate_radicado()

    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO emails(id, from_address, to_addresses, subject, body, raw, received_at, status, radicado_in)
        VALUES(?,?,?,?,?,?,?,?,?)
    """,
    (
        eid,
        payload.get("from_address"),
        payload.get("to"),
        payload.get("subject"),
        payload.get("text"),
        payload.get("raw"),
        now_iso(),
        "received",
        rad
    ))

    conn.commit()
    conn.close()

    return eid, rad

# ---------------------------
# SMTP Senders
# ---------------------------
def send_email_smtp_msg(msg: EmailMessage):
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

def send_autoreply(to_addr: str, radicado: str):
    html = f"""
    <html>
    <body>
        <h3>Confirmación de recepción</h3>
        <p>Su mensaje ha sido recibido correctamente.</p>
        <p><b>Radicado:</b> {radicado}</p>
    </body>
    </html>
    """

    msg = EmailMessage()
    msg["From"] = SMTP_USER
    msg["To"] = to_addr
    msg["Subject"] = "Confirmación de recepción"
    msg.set_content(html, subtype="html")

    send_email_smtp_msg(msg)

# ---------------------------
# Process inbound email
# ---------------------------
def process_inbound(payload: dict):
    eid, rad = save_email(payload)

    # Send autoresponse
    try:
        send_autoreply(payload.get("from_address"), rad)

        conn = sqlite3.connect(DB_FILE)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO auto_responses(email_id, to_address, subject, body, sent_at)
            VALUES (?,?,?,?,?)
        """, (eid, payload["from_address"], "Confirmación de recepción", f"Radicado {rad}", now_iso()))
        conn.commit()
        conn.close()
    except Exception as e:
        print("Autoreply error:", e)

# ---------------------------
# FastAPI startup → IMAP poller
# ---------------------------
@app.on_event("startup")
def start_poller():
    def run():
        print("✔️ Poller IMAP iniciado…")
        while True:
            try:
                poll_imap_once()
            except Exception as e:
                print("Error poller:", e)
            time.sleep(10)

    threading.Thread(target=run, daemon=True).start()

# ---------------------------
# IMAP Poller
# ---------------------------
def poll_imap_once():

    if not IMAP_USER or not IMAP_PASS:
        print("❌ No IMAP credentials (.env)")
        return

    try:
        M = imaplib.IMAP4_SSL(IMAP_HOST)
        M.login(IMAP_USER, IMAP_PASS)
        M.select("INBOX")

        typ, data = M.search(None, "UNSEEN")
        if typ != "OK":
            M.logout()
            return

        for num in data[0].split():
            typ, msg_data = M.fetch(num, "(RFC822)")
            raw = msg_data[0][1]
            msg = email.message_from_bytes(raw)

            from_addr = msg.get("From")
            to_addr = msg.get("To")
            subject = msg.get("Subject")

            body = ""

            if msg.is_multipart():
                for part in msg.walk():
                    ctype = part.get_content_type()
                    disp = str(part.get("Content-Disposition"))

                    if ctype == "text/plain" and "attachment" not in disp:
                        body = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                        break
            else:
                body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")

            payload = {
                "from_address": from_addr,
                "to": to_addr,
                "subject": subject,
                "text": body,
                "raw": raw.decode("utf-8", errors="ignore")
            }

            process_inbound(payload)

            M.store(num, "+FLAGS", "\\Seen")

        M.close()
        M.logout()

    except Exception as e:
        print("IMAP error:", e)

# ---------------------------
# API
# ---------------------------
@app.get("/api/emails")
def list_emails():
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("""
        SELECT id, from_address, subject, body, received_at, radicado_in, status
        FROM emails
        ORDER BY received_at DESC
    """)
    emails = cur.fetchall()
    conn.close()

    return [
        {
            "id": e[0],
            "from_address": e[1],
            "subject": e[2],
            "body": e[3],
            "received_at": e[4],
            "radicado_in": e[5],
            "status": e[6],
        }
        for e in emails
    ]

@app.delete("/api/emails/{email_id}")
def delete_email(email_id: str):
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("DELETE FROM emails WHERE id=?", (email_id,))
    conn.commit()
    conn.close()
    return {"message": "Correo eliminado"}

# ---------------------------
# Reply with attachments
# ---------------------------
@app.post("/api/reply")
async def reply_email(
    to: str = Form(...),
    subject: str = Form(...),
    message: str = Form(""),
    files: Optional[List[UploadFile]] = File(None)
):
    msg = EmailMessage()
    msg["From"] = SMTP_USER
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(message)

    if files:
        for f in files:
            content = await f.read()
            ctype, _ = mimetypes.guess_type(f.filename)
            if not ctype:
                ctype = "application/octet-stream"
            maintype, subtype = ctype.split("/")
            msg.add_attachment(content, maintype=maintype, subtype=subtype, filename=f.filename)

    try:
        send_email_smtp_msg(msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error enviando respuesta: {e}")

    return {"message": "Respuesta enviada correctamente ❤️"}
