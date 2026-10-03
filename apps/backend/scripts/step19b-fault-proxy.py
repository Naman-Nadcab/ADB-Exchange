#!/usr/bin/env python3
"""Local reverse proxy for isolated Chromium fault checks.

Forwards 127.0.0.1:4000 to the isolated API. A fault file can hang or fail
one path prefix. It never talks to production. Delete the fault file to
restore a straight proxy.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import time
import urllib.error
import urllib.request

UPSTREAM = os.environ.get("STEP19B_UPSTREAM", "http://127.0.0.1:4019")
FAULT_FILE = os.environ.get("STEP19B_FAULT_FILE", "/tmp/step19b-fault")
LISTEN = os.environ.get("STEP19B_LISTEN", "127.0.0.1:4000")


def rules():
    try:
        text = open(FAULT_FILE, "r", encoding="utf-8").read()
    except FileNotFoundError:
        return []
    out = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) >= 2 and parts[0] in ("hang", "status"):
            out.append(parts)
    return out


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _match(self, path):
        for parts in rules():
            if path.startswith(parts[1]):
                return parts
        return None

    def _proxy(self):
        path = self.path.split("?", 1)[0]
        matched = self._match(path)
        if matched and matched[0] == "hang":
            time.sleep(30)
            body = b'{"success":false,"error":{"code":"UPSTREAM_TIMEOUT","message":"upstream hung"}}'
            self.send_response(504)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if matched and matched[0] == "status":
            status = int(matched[2]) if len(matched) > 2 else 500
            message = " ".join(matched[3:]) if len(matched) > 3 else "injected upstream failure"
            body = json.dumps(
                {"success": False, "error": {"code": "INJECTED_UPSTREAM_FAILURE", "message": message}}
            ).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        length = int(self.headers.get("Content-Length", "0") or 0)
        payload = self.rfile.read(length) if length else None
        headers = {k: v for k, v in self.headers.items() if k.lower() not in ("host", "content-length")}
        req = urllib.request.Request(UPSTREAM + self.path, data=payload, headers=headers, method=self.command)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() in ("transfer-encoding", "content-length", "connection"):
                        continue
                    self.send_header(k, v)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as err:
            data = err.read()
            self.send_response(err.code)
            self.send_header("Content-Type", err.headers.get("Content-Type", "application/json"))
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as exc:
            msg = str(exc).encode()
            self.send_response(502)
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def do_GET(self):
        self._proxy()

    def do_POST(self):
        self._proxy()

    def do_PATCH(self):
        self._proxy()

    def do_PUT(self):
        self._proxy()

    def do_DELETE(self):
        self._proxy()

    def do_HEAD(self):
        self._proxy()

    def do_OPTIONS(self):
        self._proxy()

    def log_message(self, fmt, *args):
        return


if __name__ == "__main__":
    host, port = LISTEN.rsplit(":", 1)
    ThreadingHTTPServer((host, int(port)), H).serve_forever()
