"""
Emergency fix: mark ALL existing presentations as kw_dispatched_at = NOW()
so the Lambda stops triggering more keyword analysis runs.

Usage:
    DATABASE_URL="postgres://..." python scripts/emergency_mark_dispatched.py
"""
import os
import psycopg2

url = os.environ['DATABASE_URL']
conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM nse_documents WHERE doc_type = 'presentation' AND kw_dispatched_at IS NULL")
(pending,) = cur.fetchone()
print(f'Presentations with kw_dispatched_at IS NULL: {pending}')

cur.execute("""
    UPDATE nse_documents
    SET kw_dispatched_at = NOW()
    WHERE doc_type = 'presentation'
      AND kw_dispatched_at IS NULL
""")
print(f'Marked {cur.rowcount} rows as dispatched. Lambda will stop queuing new runs on next poll.')

cur.close()
conn.close()
