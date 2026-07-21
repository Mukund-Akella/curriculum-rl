"""
Database functions for PostgreSQL operations.
Handles all reads and writes for runs, episodes, and trajectory data.
"""

import psycopg2
import os

def get_connection():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS runs (
            id SERIAL PRIMARY KEY,
            type VARCHAR(20),
            total_timesteps INTEGER,
            starting_difficulty INTEGER,
            status VARCHAR(20),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS episodes (
            id SERIAL PRIMARY KEY,
            run_id INTEGER REFERENCES runs(id),
            episode_number INTEGER,
            episode_length INTEGER,
            difficulty INTEGER,
            reward FLOAT,
            success BOOLEAN
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS trajectory (
            id SERIAL PRIMARY KEY,
            run_id INTEGER REFERENCES runs(id),
            step INTEGER,
            x FLOAT,
            y FLOAT,
            z FLOAT
        )
    """)
    conn.commit()
    conn.close()

def create_run(type, total_timesteps, starting_difficulty):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO runs (type, total_timesteps, starting_difficulty, status)
        VALUES (%s, %s, %s, %s)
        RETURNING id
    """, (type, total_timesteps, starting_difficulty, "pending"))
    run_id = cursor.fetchone()[0]
    conn.commit()
    conn.close()
    return run_id

def insert_episode(run_id, episode_number, episode_length, difficulty, reward, success):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO episodes (run_id, episode_number, episode_length, difficulty, reward, success)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (run_id, episode_number, episode_length, difficulty, reward, success))
    conn.commit()
    conn.close()

def insert_trajectory(run_id, step, x, y, z):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO trajectory (run_id, step, x, y, z)
        VALUES (%s, %s, %s, %s, %s)
    """, (run_id, step, x, y, z))
    conn.commit()
    conn.close()

def get_runs():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM runs")
    runs = cursor.fetchall()
    conn.close()
    return runs

def get_episodes(run_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM episodes WHERE run_id = %s", (run_id,))
    episodes = cursor.fetchall()
    conn.close()
    return episodes

def get_trajectory(run_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT step, x, y, z FROM trajectory WHERE run_id = %s ORDER BY step", (run_id,))
    rows = cursor.fetchall()
    conn.close()
    return rows

def update_run_status(run_id, status):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE runs SET status = %s WHERE id = %s", (status, run_id))
    conn.commit()
    conn.close()

def delete_run(run_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM episodes WHERE run_id = %s", (run_id,))
    cursor.execute("DELETE FROM trajectory WHERE run_id = %s", (run_id,))
    cursor.execute("DELETE FROM runs WHERE id = %s", (run_id,))
    conn.commit()
    conn.close()