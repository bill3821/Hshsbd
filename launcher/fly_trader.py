#!/usr/bin/env python3
"""Fly Trader launcher.

Serves the app from a local web server and opens it in your browser.
Runs on stock Python 3 — no packages to install.

    python3 launcher/fly_trader.py

Options:
    FLY_RPC_URL=<url>   use this RPC endpoint instead of the saved one
    --port N            serve on a specific port (default: first free from 8787)
    --no-browser        start the server but don't open a browser
    --set-rpc           re-ask for the RPC endpoint, then start
"""

import argparse
import functools
import http.server
import json
import os
import socket
import socketserver
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "config.local.js")
APP = "Index.html"
PUBLIC_RPC = "https://api.mainnet-beta.solana.com"
DEFAULT_PORT = 8787


# --------------------------------------------------------------------------
# RPC config — stored in config.local.js, which is git-ignored
# --------------------------------------------------------------------------
def read_rpc():
    if not os.path.exists(CONFIG):
        return None
    with open(CONFIG, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line.startswith("window.FLY_RPC_URL"):
                value = line.split("=", 1)[1].strip().rstrip(";").strip()
                try:
                    return json.loads(value)
                except ValueError:
                    return value.strip("\"'")
    return None


def write_rpc(url):
    with open(CONFIG, "w", encoding="utf-8") as fh:
        fh.write(
            "// Written by launcher/fly_trader.py. Git-ignored: your key stays local.\n"
            "window.FLY_RPC_URL = %s;\n" % json.dumps(url)
        )


def resolve_rpc(force_prompt=False):
    env = os.environ.get("FLY_RPC_URL", "").strip()
    if env:
        write_rpc(env)
        return env

    saved = read_rpc()
    if saved and not force_prompt:
        return saved

    if not sys.stdin.isatty():
        # Launched from a desktop icon with no console — don't block on input.
        return saved or PUBLIC_RPC

    print("\nRPC endpoint (Helius, QuickNode, Triton, ...).")
    print("Paste yours and press Enter — press Enter alone for the free public one.")
    if saved:
        print("Currently saved: %s" % mask(saved))
    try:
        answer = input("RPC URL: ").strip()
    except (EOFError, KeyboardInterrupt):
        answer = ""
    url = answer or saved or PUBLIC_RPC
    write_rpc(url)
    return url


def mask(url):
    """Hide the api key when echoing an endpoint to the console."""
    if "api-key=" not in url:
        return url
    head, key = url.split("api-key=", 1)
    key = key.split("&", 1)[0]
    if len(key) <= 8:
        return head + "api-key=***"
    return "%sapi-key=%s...%s" % (head, key[:4], key[-4:])


# --------------------------------------------------------------------------
# server
# --------------------------------------------------------------------------
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):  # keep the console readable
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        if self.path in ("/", "/index.html"):
            self.path = "/" + APP
        return super().send_head()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def free_port(preferred):
    for port in range(preferred, preferred + 40):
        with socket.socket() as probe:
            try:
                probe.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise SystemExit("No free port in %d-%d." % (preferred, preferred + 40))


def main():
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--set-rpc", action="store_true")
    args = parser.parse_args()

    app_path = os.path.join(ROOT, APP)
    if not os.path.exists(app_path):
        raise SystemExit("Can't find %s next to the launcher." % APP)

    rpc = resolve_rpc(force_prompt=args.set_rpc)
    port = free_port(args.port)
    url = "http://127.0.0.1:%d/" % port

    handler = functools.partial(Handler, directory=ROOT)
    server = Server(("127.0.0.1", port), handler)

    print("")
    print("  MEMECOIN SNIPER is running")
    print("  ---------------------------------------------")
    print("  app  %s" % url)
    print("  rpc  %s" % mask(rpc))
    print("")
    print("  Leave this window open while you trade.")
    print("  Press Ctrl+C here to shut the app down.")
    print("")

    if not args.no_browser:
        threading.Timer(0.6, webbrowser.open, args=(url,)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Shutting down. Bye.")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
