"""
API client resources for Dagster pipelines.

Will define:
- YalidineAPIClient: authenticated client for the Yalidine tracking REST API
- OSRMClient: client for Open Source Routing Machine route optimization queries
- FuelPriceAPIClient: client for Algerian government fuel price endpoint

Each client handles auth, rate limiting, and retry with exponential backoff.
"""
