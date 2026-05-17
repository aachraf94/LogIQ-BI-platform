"""
Dagster resource registry — exports all_resources dict consumed by definitions.py.
"""

from dagster import EnvVar

from .api_clients import (
    YalidineAPIClient,
    HRForceAPIClient,
    CashBoxAPIClient,
    PaieAPIClient,
    TransportAPIClient,
)
from .database import WarehousePostgresResource

all_resources = {
    "yalidine_api": YalidineAPIClient(
        base_url=EnvVar("API_BASE_URL"),
        api_id=EnvVar("YALIDINE_API_ID"),
        api_token=EnvVar("YALIDINE_API_TOKEN"),
    ),
    "hrforce_api": HRForceAPIClient(
        base_url=EnvVar("API_BASE_URL"),
        token=EnvVar("HRFORCE_API_TOKEN"),
    ),
    "cashbox_api": CashBoxAPIClient(
        base_url=EnvVar("API_BASE_URL"),
        token=EnvVar("CASHBOX_API_TOKEN"),
    ),
    "paie_api": PaieAPIClient(
        base_url=EnvVar("API_BASE_URL"),
        token=EnvVar("PAIE_API_TOKEN"),
    ),
    "transport_api": TransportAPIClient(
        base_url=EnvVar("API_BASE_URL"),
        token=EnvVar("TRANSPORT_API_TOKEN"),
    ),
    "warehouse_db": WarehousePostgresResource(
        host=EnvVar("WAREHOUSE_DB_HOST"),
        port=EnvVar.int("WAREHOUSE_DB_PORT"),
        database=EnvVar("WAREHOUSE_DB_NAME"),
        user=EnvVar("WAREHOUSE_DB_USER"),
        password=EnvVar("WAREHOUSE_DB_PASSWORD"),
    ),
}

__all__ = [
    "all_resources",
    "YalidineAPIClient",
    "HRForceAPIClient",
    "CashBoxAPIClient",
    "PaieAPIClient",
    "TransportAPIClient",
    "WarehousePostgresResource",
]
