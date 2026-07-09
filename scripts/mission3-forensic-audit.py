#!/usr/bin/env python3
"""Mission 3 — repository forensic scan (read-only counts)."""
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(os.environ.get("ROOT", "/opt/m-live"))
SKIP = {"node_modules", ".git", "dist", ".next", "coverage", "e2e/reports", "audit"}


def rg_count(pattern: str, glob: str = "") -> int:
    cmd = ["rg", "-c", pattern, str(ROOT)]
    if glob:
        cmd.extend(["-g", glob])
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if r.returncode not in (0, 1):
            return -1
        return sum(int(line.split(":")[-1]) for line in r.stdout.strip().splitlines() if ":" in line)
    except Exception:
        return -1


def count_files(glob: str) -> int:
    return len(list(ROOT.glob(glob)))


apps = ROOT / "apps"
backend_src = apps / "backend" / "src"
frontend_src = apps / "frontend" / "src"

report = {
    "scan_root": str(ROOT),
    "code_quality_signals": {
        "todo_fixme_backend": rg_count(r"TODO|FIXME|XXX", "apps/backend/src/**/*.ts"),
        "todo_fixme_frontend": rg_count(r"TODO|FIXME|XXX", "apps/frontend/src/**/*.{ts,tsx}"),
        "console_log_backend": rg_count(r"console\.(log|debug|info)", "apps/backend/src/**/*.ts"),
        "console_log_frontend": rg_count(r"console\.(log|debug|info)", "apps/frontend/src/**/*.{ts,tsx}"),
        "debugger_statements": rg_count(r"\bdebugger\b", "apps/**/*.{ts,tsx,js}"),
    },
    "structure": {
        "backend_ts_files": count_files("apps/backend/src/**/*.ts"),
        "frontend_tsx_files": count_files("apps/frontend/src/**/*.{ts,tsx}"),
        "admin_tsx_files": count_files("apps/admin-panel/src/**/*.{ts,tsx}"),
        "e2e_specs": count_files("e2e/**/*.spec.ts") + count_files("e2e/mission2/**/*.spec.ts"),
        "migrations_hint": count_files("apps/backend/src/database/**/*.ts"),
    },
    "warnings": [],
}

# Flag noisy patterns only when count is high (informational, not auto-delete)
if report["code_quality_signals"]["console_log_frontend"] > 50:
    report["warnings"].append("frontend has elevated console.log usage — review before launch")
if report["code_quality_signals"]["todo_fixme_backend"] > 30:
    report["warnings"].append("backend TODO/FIXME count elevated — triage recommended")

print(json.dumps(report, indent=2))
