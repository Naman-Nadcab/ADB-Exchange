#!/usr/bin/env python3
"""Mission 3 — API/health latency snapshot."""
import json
import os
import statistics
import time
import urllib.request

BASE = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:4000").rstrip("/")
PATHS = [
    "/health",
    "/api/v1/spot/markets",
    "/api/v1/spot/ticker/BTC_USDT",
    "/api/v1/spot/orderbook/BTC_USDT",
    "/metrics",
]


def measure(url: str, n: int = 10) -> dict:
    samples = []
    errors = 0
    for _ in range(n):
        t0 = time.perf_counter()
        try:
            with urllib.request.urlopen(url, timeout=10) as r:
                r.read(4096)
            if r.status >= 400:
                errors += 1
        except Exception:
            errors += 1
            continue
        samples.append((time.perf_counter() - t0) * 1000)
    if not samples:
        return {"url": url, "error": "all_failed", "errors": errors}
    s = sorted(samples)
    p = lambda q: s[min(len(s) - 1, int(q * len(s)) - 1)]
    return {
        "url": url,
        "samples": len(samples),
        "errors": errors,
        "p50_ms": round(p(0.5), 1),
        "p95_ms": round(p(0.95), 1),
        "max_ms": round(max(s), 1),
        "mean_ms": round(statistics.mean(s), 1),
    }


out = {"base": BASE, "measured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "endpoints": []}
for p in PATHS:
    out["endpoints"].append(measure(f"{BASE}{p}"))
print(json.dumps(out, indent=2))
