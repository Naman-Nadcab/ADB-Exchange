#!/usr/bin/env python3
"""Lockdown B: controlled stop-limit journey + journal DB proof. MOCK only."""
import json
import subprocess
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:4000"
EMAIL = "qa_trader_a@local.exchange"
PASSWORD = "TestPass123"
CLIENT_ID = f"jlock-b-{int(time.time())}"


def psql(sql: str) -> str:
    cmd = [
        "docker",
        "exec",
        "exchange-postgres",
        "psql",
        "-U",
        "exchange",
        "-d",
        "exchange",
        "-t",
        "-A",
        "-c",
        sql,
    ]
    return subprocess.check_output(cmd, text=True).strip()


def db_counts() -> dict:
    raw = psql(
        """
SELECT 'forex_orders|'||count(*) FROM forex_orders
UNION ALL SELECT 'forex_journal_events|'||count(*) FROM forex_journal_events
UNION ALL SELECT 'forex_positions_open|'||count(*) FROM forex_positions WHERE status='OPEN'
UNION ALL SELECT 'forex_executions|'||count(*) FROM forex_executions
UNION ALL SELECT 'forex_fills|'||count(*) FROM forex_fills
UNION ALL SELECT 'forex_ledger_transactions|'||count(*) FROM forex_ledger_transactions;
"""
    )
    out = {}
    for line in raw.splitlines():
        k, v = line.split("|", 1)
        out[k] = int(v)
    return out


def req(method, path, token=None, body=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def post(path, token, body):
    return req("POST", path, token, body)


def main():
    report = {"clientOrderId": CLIENT_ID, "baseUrl": BASE}
    report["baseline"] = {"db": db_counts(), "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}

    _, login = req("POST", "/api/v1/auth/login/password", None, {"email": EMAIL, "password": PASSWORD})
    token = login["data"]["accessToken"]
    account_id = login["data"]["user"]["id"]
    report["accountId"] = account_id

    post("/api/v1/forex/market-data/demo-price", token, {"symbol": "EURUSD", "price": "1.16000"})

    _, placed = post(
        "/api/v1/forex/orders",
        token,
        {
            "clientOrderId": CLIENT_ID,
            "symbol": "EURUSD",
            "side": "buy",
            "orderType": "stop_limit",
            "volume": "0.01",
            "requestedPrice": "1.16500",
            "limitPrice": "1.16500",
            "timeInForce": "GTC",
        },
    )
    order = (placed.get("data") or {}).get("order") or {}
    order_id = order.get("orderId")
    report["order"] = {
        "orderId": order_id,
        "statusAfterSubmit": order.get("status"),
        "timeInForce": order.get("timeInForce"),
        "requestedPrice": order.get("requestedPrice"),
        "limitPrice": order.get("limitPrice"),
    }

    post("/api/v1/forex/market-data/demo-price", token, {"symbol": "EURUSD", "price": "1.16500"})
    final_status = order.get("status")
    for _ in range(15):
        time.sleep(0.4)
        _, got = req("GET", f"/api/v1/forex/orders/{order_id}", token)
        o = (got.get("data") or {}).get("order") or {}
        final_status = o.get("status")
        if final_status == "FILLED":
            report["order"]["executionId"] = o.get("executionId")
            break
    report["order"]["finalStatus"] = final_status

    mid = db_counts()
    report["afterJourney"] = {"db": mid, "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    report["dbDelta"] = {k: mid[k] - report["baseline"]["db"][k] for k in mid}

    jrows = psql(
        f"""
SELECT json_agg(row_to_json(t)) FROM (
  SELECT id::text, event_type, order_id, reference_id, created_at::text,
         metadata->>'symbol' AS symbol, metadata->>'side' AS side,
         metadata->>'orderType' AS order_type, metadata->>'timeInForce' AS tif,
         metadata->>'requestedPrice' AS requested_price, metadata->>'limitPrice' AS limit_price,
         metadata->>'executionId' AS execution_id, metadata->>'status' AS status
  FROM forex_journal_events
  WHERE order_id = '{order_id}'
  ORDER BY created_at ASC
) t;
"""
    )
    report["journalDbForOrder"] = json.loads(jrows) if jrows and jrows != "" else []

    _, japi = req("GET", "/api/v1/forex/journal?limit=50", token)
    api_events = (japi.get("data") or {}).get("events") or []
    report["journalApiForOrder"] = [e for e in api_events if e.get("orderId") == order_id]

    _, idem = post(
        "/api/v1/forex/orders",
        token,
        {
            "clientOrderId": CLIENT_ID,
            "symbol": "EURUSD",
            "side": "buy",
            "orderType": "stop_limit",
            "volume": "0.01",
            "requestedPrice": "1.16500",
            "limitPrice": "1.16500",
            "timeInForce": "GTC",
        },
    )
    idem_o = (idem.get("data") or {}).get("order") or {}
    report["idempotency"] = {
        "replayOrderId": idem_o.get("orderId"),
        "sameOrderId": idem_o.get("orderId") == order_id,
        "journalCountAfterReplay": int(psql("SELECT count(*) FROM forex_journal_events")),
    }

    pos = psql(
        f"SELECT position_id, status, volume FROM forex_positions WHERE account_id = '{account_id}' AND symbol = 'EURUSD' ORDER BY updated_at DESC LIMIT 3;"
    )
    report["positionsSample"] = pos

    exec_row = ""
    if report["order"].get("executionId"):
        eid = report["order"]["executionId"]
        exec_row = psql(
            f"SELECT execution_id::text, client_exec_id, status FROM forex_executions WHERE execution_id = '{eid}' LIMIT 1;"
        )
    report["executionDb"] = exec_row

    out_path = "/opt/m-live/.build/forex-phase2-journal-lockdown-b-evidence.json"
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
