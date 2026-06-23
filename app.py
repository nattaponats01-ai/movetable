import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
import json
import secrets
from werkzeug.security import generate_password_hash, check_password_hash
import os

app = Flask(__name__)
CORS(app)

DB_NAME = "database.db"

# Try importing psycopg2 for PostgreSQL support
try:
    import psycopg2
    import psycopg2.extras
    HAS_POSTGRES = True
except ImportError:
    HAS_POSTGRES = False

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL and os.environ.get("RENDER"):
    DATABASE_URL = "postgresql://neondb_owner:npg_zcAdN3TpV9Cx@ep-icy-mud-ad1cjv06-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

USE_POSTGRES = HAS_POSTGRES and DATABASE_URL is not None

def get_db_connection():
    if USE_POSTGRES:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    else:
        conn = sqlite3.connect(DB_NAME)
        return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    if USE_POSTGRES:
        # PostgreSQL schema
        c.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS schedules (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                data TEXT NOT NULL,
                created_at VARCHAR(255) NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                token VARCHAR(255) PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at VARCHAR(255) NOT NULL,
                expires_at VARCHAR(255) NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                username VARCHAR(255),
                action TEXT NOT NULL,
                ip_address VARCHAR(255),
                timestamp VARCHAR(255) NOT NULL
            )
        ''')
    else:
        # SQLite schema
        c.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                username TEXT,
                action TEXT NOT NULL,
                ip_address TEXT,
                timestamp TEXT NOT NULL
            )
        ''')
        
        # Check if password_hash column exists (in case database was created before this change)
        c.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in c.fetchall()]
        if 'password_hash' not in columns:
            c.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
            
    conn.commit()
    conn.close()

init_db()

# --- HELPERS ---

def log_action(user_id, username, action):
    ip_address = request.remote_addr
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db_connection()
    c = conn.cursor()
    if USE_POSTGRES:
        c.execute('INSERT INTO audit_logs (user_id, username, action, ip_address, timestamp) VALUES (%s, %s, %s, %s, %s)',
                  (user_id, username, action, ip_address, timestamp))
    else:
        c.execute('INSERT INTO audit_logs (user_id, username, action, ip_address, timestamp) VALUES (?, ?, ?, ?, ?)',
                  (user_id, username, action, ip_address, timestamp))
    conn.commit()
    conn.close()

def create_session(user_id):
    token = secrets.token_hex(32)
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    expires_at = (datetime.now() + timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db_connection()
    c = conn.cursor()
    if USE_POSTGRES:
        c.execute('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (%s, %s, %s, %s)',
                  (token, user_id, created_at, expires_at))
    else:
        c.execute('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
                  (token, user_id, created_at, expires_at))
    conn.commit()
    conn.close()
    return token

def get_user_from_token():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db_connection()
    c = conn.cursor()
    sql = '''
        SELECT u.id, u.username FROM users u
        JOIN sessions s ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > ?
    '''
    if USE_POSTGRES:
        c.execute(sql.replace('?', '%s'), (token, now))
    else:
        c.execute(sql, (token, now))
    user = c.fetchone()
    conn.close()
    if user:
        return {"id": user[0], "username": user[1]}
    return None

# --- AUTH API ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    
    if not username or not password:
        return jsonify({"error": "กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน"}), 400
        
    conn = get_db_connection()
    c = conn.cursor()
    
    # Check if user already exists
    if USE_POSTGRES:
        c.execute('SELECT id FROM users WHERE username = %s', (username,))
    else:
        c.execute('SELECT id FROM users WHERE username = ?', (username,))
    existing_user = c.fetchone()
    if existing_user:
        conn.close()
        log_action(None, username, f"สมัครสมาชิกล้มเหลว: ชื่อผู้ใช้ซ้ำ ({username})")
        return jsonify({"error": "ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว"}), 400
        
    password_hash = generate_password_hash(password)
    
    if USE_POSTGRES:
        c.execute('INSERT INTO users (username, password_hash) VALUES (%s, %s) RETURNING id', (username, password_hash))
        user_id = c.fetchone()[0]
    else:
        c.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', (username, password_hash))
        user_id = c.lastrowid
        
    conn.commit()
    
    token = create_session(user_id)
    log_action(user_id, username, "สมัครสมาชิกใหม่สำเร็จ")
    conn.close()
    
    return jsonify({
        "message": "สมัครสมาชิกสำเร็จ",
        "user_id": user_id,
        "username": username,
        "token": token
    })

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    
    if not username or not password:
        return jsonify({"error": "กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน"}), 400
        
    conn = get_db_connection()
    c = conn.cursor()
    if USE_POSTGRES:
        c.execute('SELECT id, password_hash FROM users WHERE username = %s', (username,))
    else:
        c.execute('SELECT id, password_hash FROM users WHERE username = ?', (username,))
    user = c.fetchone()
    
    if not user:
        conn.close()
        log_action(None, username, f"เข้าสู่ระบบล้มเหลว: ไม่พบชื่อผู้ใช้งาน ({username})")
        return jsonify({"error": "ไม่พบชื่อผู้ใช้งานนี้ กรุณาสมัครใช้งานใหม่"}), 401
        
    user_id, stored_hash = user
    
    # Check if user exists but has no password hash (legacy account migration)
    if not stored_hash:
        new_hash = generate_password_hash(password)
        if USE_POSTGRES:
            c.execute('UPDATE users SET password_hash = %s WHERE id = %s', (new_hash, user_id))
        else:
            c.execute('UPDATE users SET password_hash = ? WHERE id = ?', (new_hash, user_id))
        conn.commit()
        
        token = create_session(user_id)
        log_action(user_id, username, "ตั้งค่ารหัสผ่านแรกเข้าสำเร็จและล็อกอิน")
        conn.close()
        return jsonify({
            "message": "ตั้งค่ารหัสผ่านสำหรับบัญชีเดิมสำเร็จและเข้าสู่ระบบแล้ว",
            "user_id": user_id,
            "username": username,
            "token": token
        })
        
    # Verify password hash
    if not check_password_hash(stored_hash, password):
        conn.close()
        log_action(user_id, username, "เข้าสู่ระบบล้มเหลว: รหัสผ่านไม่ถูกต้อง")
        return jsonify({"error": "รหัสผ่านไม่ถูกต้อง"}), 401
        
    token = create_session(user_id)
    log_action(user_id, username, "เข้าสู่ระบบสำเร็จ")
    conn.close()
    return jsonify({
        "message": "เข้าสู่ระบบสำเร็จ",
        "user_id": user_id,
        "username": username,
        "token": token
    })

# --- SCHEDULES & LOGS API ---

@app.route('/api/schedules', methods=['GET', 'POST'])
def handle_schedules():
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "สิทธิ์การเข้าใช้งานหมดอายุหรือโทเคนไม่ถูกต้อง"}), 401

    conn = get_db_connection()
    c = conn.cursor()

    if request.method == 'GET':
        if USE_POSTGRES:
            c.execute('SELECT id, name, data, created_at FROM schedules WHERE user_id = %s ORDER BY id DESC', (user["id"],))
        else:
            c.execute('SELECT id, name, data, created_at FROM schedules WHERE user_id = ? ORDER BY id DESC', (user["id"],))
        rows = c.fetchall()
        schedules = []
        for row in rows:
            schedules.append({
                "id": row[0],
                "name": row[1],
                "data": json.loads(row[2]),
                "created_at": row[3]
            })
        log_action(user["id"], user["username"], "เรียกดูประวัติตารางนำขบวน")
        conn.close()
        return jsonify(schedules)

    if request.method == 'POST':
        req_data = request.json
        name = req_data.get('name', 'ไม่ระบุชื่อ')
        data_dict = req_data.get('data', {})
        rows = data_dict.get('rows', [])
        
        # Server-side calculation verification (Audit computation)
        total_dist = 0.0
        for r in rows:
            try:
                total_dist += float(r.get('distance', 0) or 0)
            except ValueError:
                pass
                
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        schedule_data = json.dumps(data_dict)

        if USE_POSTGRES:
            c.execute('INSERT INTO schedules (user_id, name, data, created_at) VALUES (%s, %s, %s, %s) RETURNING id', 
                      (user["id"], name, schedule_data, created_at))
            new_id = c.fetchone()[0]
        else:
            c.execute('INSERT INTO schedules (user_id, name, data, created_at) VALUES (?, ?, ?, ?)', 
                      (user["id"], name, schedule_data, created_at))
            new_id = c.lastrowid
            
        conn.commit()
        
        log_action(user["id"], user["username"], f"บันทึกตารางใหม่ '{name}' (จำนวนจุดตรวจ: {len(rows)} จุด, ระยะทางรวม: {total_dist:.2f} กม.)")
        conn.close()
        return jsonify({"message": "Saved successfully", "id": new_id})

@app.route('/api/schedules/<int:schedule_id>', methods=['DELETE'])
def delete_schedule(schedule_id):
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "สิทธิ์การเข้าใช้งานหมดอายุหรือโทเคนไม่ถูกต้อง"}), 401
        
    conn = get_db_connection()
    c = conn.cursor()
    
    # Get schedule name for logging
    if USE_POSTGRES:
        c.execute('SELECT name FROM schedules WHERE id = %s AND user_id = %s', (schedule_id, user["id"]))
    else:
        c.execute('SELECT name FROM schedules WHERE id = ? AND user_id = ?', (schedule_id, user["id"]))
    sch = c.fetchone()
    sch_name = sch[0] if sch else "ไม่ระบุชื่อ"
    
    if USE_POSTGRES:
        c.execute('DELETE FROM schedules WHERE id = %s AND user_id = %s', (schedule_id, user["id"]))
    else:
        c.execute('DELETE FROM schedules WHERE id = ? AND user_id = ?', (schedule_id, user["id"]))
        
    conn.commit()
    conn.close()
    
    log_action(user["id"], user["username"], f"ลบตารางนำขบวน '{sch_name}' (ID: {schedule_id})")
    return jsonify({"message": "Deleted successfully"})

@app.route('/api/audit_logs', methods=['GET'])
def get_audit_logs():
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "สิทธิ์การเข้าใช้งานหมดอายุหรือโทเคนไม่ถูกต้อง"}), 401
        
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('SELECT id, username, action, ip_address, timestamp FROM audit_logs ORDER BY id DESC LIMIT 100')
    rows = c.fetchall()
    logs = []
    for row in rows:
        logs.append({
            "id": row[0],
            "username": row[1] if row[1] else "SYSTEM/GUEST",
            "action": row[2],
            "ip_address": row[3],
            "timestamp": row[4]
        })
    conn.close()
    
    # Log this log-viewing action as well
    log_action(user["id"], user["username"], "เข้าเรียกดูบันทึกประวัติการใช้งานระบบ (Audit Logs)")
    return jsonify(logs)

if __name__ == '__main__':
    app.run(port=5000, debug=True)

