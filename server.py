#!/usr/bin/env python3
import http.server
import os

class HTMLFallbackHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) and not self.path.endswith('.html'):
            candidate = path + '.html'
            if os.path.exists(candidate):
                self.path = self.path.rstrip('/') + '.html'
        super().do_GET()

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist'))
    http.server.test(HandlerClass=HTMLFallbackHandler, port=8080)
