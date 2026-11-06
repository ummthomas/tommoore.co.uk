#!/usr/bin/env python3
# Serves the site for working on it locally: python3 tools/serve.py [port]
#
# Differs from a plain `python3 -m http.server` in three ways:
# - Browsers are told never to cache, so a normal refresh always shows the latest files
# - It only answers this computer, not others on the network
# - It won't serve anything secret: dotfiles such as .env, and the readable private/ sources

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent


class Handler(SimpleHTTPRequestHandler):
    def is_hidden(self):
        parts = unquote(urlsplit(self.path).path).split('/')
        return any(part.startswith('.') or part == 'private' for part in parts)

    def do_GET(self):
        if self.is_hidden():
            self.send_error(404)
        else:
            super().do_GET()

    def do_HEAD(self):
        if self.is_hidden():
            self.send_error(404)
        else:
            super().do_HEAD()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
print(f'Serving the site at http://localhost:{port} (Ctrl-C to stop)', flush=True)
ThreadingHTTPServer(('localhost', port), partial(Handler, directory=str(ROOT))).serve_forever()
