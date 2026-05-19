"""Run all Dagster ETL assets via Python API."""
import os, sys
sys.path.insert(0, '.')

# Load .env file manually
_env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith('#') and '=' in _line:
                _k, _, _v = _line.partition('=')
                os.environ.setdefault(_k.strip(), _v.strip())

from dagster import materialize
from src.definitions import defs

print("Starting ETL run...", flush=True)
result = materialize(
    defs.assets,
    resources=defs.resources,
    raise_on_error=False,
)
print(f"\nRun completed. Success: {result.success}", flush=True)

failures = []
for event in result.all_events:
    if event.event_type_value == "STEP_FAILURE":
        step = getattr(event, "step_key", "unknown")
        msg = ""
        if hasattr(event, "event_specific_data") and event.event_specific_data:
            err = getattr(event.event_specific_data, "error", None)
            if err:
                msg = str(err.message)[:300]
        failures.append(f"  FAILED: {step} — {msg}")
        print(f"FAILED: {step}", flush=True)
    elif event.event_type_value == "ASSET_MATERIALIZATION":
        step = getattr(event, "step_key", "")
        print(f"OK: {step}", flush=True)

if failures:
    print("\n=== FAILURES ===")
    for f in failures:
        print(f)
else:
    print("\nAll assets materialized successfully!")
