"""
Warehouse PostgreSQL resource — single connection wrapper used by all ETL assets.
"""

from contextlib import contextmanager
import psycopg2
import psycopg2.extras
from dagster import ConfigurableResource


class WarehousePostgresResource(ConfigurableResource):
    host: str
    port: int = 5433
    database: str
    user: str
    password: str

    def _connect(self):
        return psycopg2.connect(
            host=self.host,
            port=self.port,
            dbname=self.database,
            user=self.user,
            password=self.password,
            options="-c search_path=warehouse,public",
        )

    @contextmanager
    def get_connection(self):
        """Yields a psycopg2 connection. Commits on success, rolls back on exception."""
        conn = self._connect()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def execute(self, sql: str, params=None) -> None:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)

    def fetch_one(self, sql: str, params=None):
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                return cur.fetchone()

    def fetch_all(self, sql: str, params=None) -> list:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                return cur.fetchall()

    def bulk_insert(self, conn, sql: str, records: list, page_size: int = 1000) -> int:
        """Batch insert using execute_values. Returns row count inserted."""
        if not records:
            return 0
        with conn.cursor() as cur:
            psycopg2.extras.execute_values(cur, sql, records, page_size=page_size)
            return cur.rowcount
