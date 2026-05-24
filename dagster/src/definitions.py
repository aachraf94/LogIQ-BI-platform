"""
Dagster Definitions — entry point for all assets, resources, schedules, and sensors.
"""

from dagster import Definitions

from .assets import all_assets
from .resources import all_resources
from .schedules import all_schedules
from .sensors import all_sensors

defs = Definitions(
    assets=all_assets,
    resources=all_resources,
    schedules=all_schedules,
    sensors=all_sensors,
)
