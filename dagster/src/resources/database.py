"""
Database resources for Dagster pipelines.

Will define:
- MySQLResource: connection pool to the Yalidine operational MySQL database
- PlatformPostgresResource: connection to the LOGIQ platform PostgreSQL database
- WarehousePostgresResource: connection to the LOGIQ data warehouse PostgreSQL database

Each resource reads credentials from environment variables and uses SQLAlchemy connection pooling.
TODO: Add connection retry logic and health check on startup.
"""
