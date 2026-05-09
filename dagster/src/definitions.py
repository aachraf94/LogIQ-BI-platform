"""
Dagster Definitions — entry point for all assets, resources, and schedules.
All asset lists will be populated as ETL pipelines are implemented.
"""

from dagster import Definitions

from .assets import all_assets
from .resources import all_resources
from .schedules import all_schedules

defs = Definitions(
    assets=all_assets,
    resources=all_resources,
    schedules=all_schedules,
)
