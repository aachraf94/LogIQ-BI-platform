"""
Run-status sensors — post ETL run lifecycle events to the Django webhook.
Each sensor fires for one Dagster run status and POSTs to /api/integrations/etl/webhook/.
"""

import logging
import os
from datetime import datetime, timezone

import requests
from dagster import (
    DagsterEventType,
    DagsterRunStatus,
    RunFailureSensorContext,
    RunStatusSensorContext,
    run_failure_sensor,
    run_status_sensor,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _triggered_by(run) -> str:
    tags = run.tags or {}
    if "dagster/schedule_name" in tags:
        return "schedule"
    if "dagster/sensor_name" in tags:
        return "sensor"
    return "manual"


def _to_iso(ts: float | None) -> str | None:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def _post_webhook(payload: dict) -> None:
    backend_url = os.environ.get("BACKEND_URL", "http://localhost:8000")
    token = os.environ.get("DAGSTER_WEBHOOK_TOKEN", "")
    url = f"{backend_url.rstrip('/')}/api/integrations/etl/webhook/"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["X-Dagster-Webhook-Token"] = token
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=10)
        resp.raise_for_status()
        logger.info("Webhook posted for run %s → %s", payload.get("dagster_run_id"), payload.get("status"))
    except Exception as exc:
        logger.warning("ETL webhook call failed: %s", exc)


def _collect_row_counts(context: RunStatusSensorContext, run_id: str) -> dict:
    """Extract row_count metadata from every ASSET_MATERIALIZATION event in the run."""
    assets: dict[str, int] = {}
    try:
        # instance.all_logs() is the correct API for fetching events by run_id in
        # Dagster 1.9+ — EventRecordsFilter dropped the run_id parameter in that version.
        logs = context.instance.all_logs(run_id, of_type=DagsterEventType.ASSET_MATERIALIZATION)
        for log_entry in logs:
            mat = log_entry.dagster_event.asset_materialization
            if mat is None:
                continue
            name = mat.asset_key.path[-1]
            rc = mat.metadata.get("row_count")
            if rc is not None:
                assets[name] = int(rc.value)
    except Exception as exc:
        logger.warning("Could not collect row counts for run %s: %s", run_id, exc)
    return assets


def _user_tags(run) -> dict:
    """Return run tags with Dagster-internal keys stripped."""
    return {k: v for k, v in (run.tags or {}).items() if not k.startswith("dagster/")}


# ---------------------------------------------------------------------------
# Sensors
# ---------------------------------------------------------------------------

def _get_stats(context, run_id):
    """Return (start_time, end_time) floats from the run stats. Never raises."""
    try:
        stats = context.instance.get_run_stats(run_id)
        return stats.start_time, stats.end_time
    except Exception as exc:
        logger.warning("Could not fetch run stats for %s: %s", run_id, exc)
        return None, None


@run_status_sensor(run_status=DagsterRunStatus.STARTED, name="etl_started_sensor")
def etl_started_sensor(context: RunStatusSensorContext):
    run = context.dagster_run
    start_time, _ = _get_stats(context, run.run_id)
    _post_webhook({
        "dagster_run_id": run.run_id,
        "job_name": run.job_name,
        "status": "running",
        "triggered_by": _triggered_by(run),
        "started_at": _to_iso(start_time) or datetime.now(tz=timezone.utc).isoformat(),
        "tags": _user_tags(run),
    })


@run_status_sensor(run_status=DagsterRunStatus.SUCCESS, name="etl_success_sensor")
def etl_success_sensor(context: RunStatusSensorContext):
    run = context.dagster_run
    assets = _collect_row_counts(context, run.run_id)
    start_time, end_time = _get_stats(context, run.run_id)
    duration = int(end_time - start_time) if start_time and end_time else None
    _post_webhook({
        "dagster_run_id": run.run_id,
        "job_name": run.job_name,
        "status": "success",
        "triggered_by": _triggered_by(run),
        "started_at": _to_iso(start_time),
        "finished_at": _to_iso(end_time),
        "duration_seconds": duration,
        "assets_materialized": assets,
        "total_rows_loaded": sum(assets.values()),
        "tags": _user_tags(run),
    })


@run_failure_sensor(name="etl_failure_sensor")
def etl_failure_sensor(context: RunFailureSensorContext):
    run = context.dagster_run
    error_msg = ""
    if context.failure_event:
        error_msg = context.failure_event.message or ""
    start_time, end_time = _get_stats(context, run.run_id)
    duration = int(end_time - start_time) if start_time and end_time else None
    _post_webhook({
        "dagster_run_id": run.run_id,
        "job_name": run.job_name,
        "status": "failed",
        "triggered_by": _triggered_by(run),
        "started_at": _to_iso(start_time),
        "finished_at": _to_iso(end_time),
        "duration_seconds": duration,
        "error_message": error_msg,
        "tags": _user_tags(run),
    })


@run_status_sensor(run_status=DagsterRunStatus.CANCELED, name="etl_canceled_sensor")
def etl_canceled_sensor(context: RunStatusSensorContext):
    run = context.dagster_run
    start_time, end_time = _get_stats(context, run.run_id)
    _post_webhook({
        "dagster_run_id": run.run_id,
        "job_name": run.job_name,
        "status": "cancelled",
        "triggered_by": _triggered_by(run),
        "started_at": _to_iso(start_time),
        "finished_at": _to_iso(end_time),
    })


all_sensors = [
    etl_started_sensor,
    etl_success_sensor,
    etl_failure_sensor,
    etl_canceled_sensor,
]
