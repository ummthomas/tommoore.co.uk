import base64
import json
import os
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler

CLIENT_ID = os.environ.get("SPOTIFY_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("SPOTIFY_CLIENT_SECRET", "")
REDIRECT_URI = os.environ.get("SPOTIFY_REDIRECT_URI", "")


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if "error" in params:
            self._respond(400, f"<h2>Error: {params['error'][0]}</h2>")
            return

        if "code" not in params:
            self._respond(400, "<h2>No code in callback.</h2>")
            return

        code = params["code"][0]
        credentials = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
        data = urllib.parse.urlencode({
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
        }).encode()

        req = urllib.request.Request(
            "https://accounts.spotify.com/api/token",
            data=data,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        try:
            with urllib.request.urlopen(req) as resp:
                tokens = json.loads(resp.read())
        except Exception as e:
            self._respond(500, f"<h2>Token exchange failed: {e}</h2>")
            return

        refresh_token = tokens.get("refresh_token", "")
        html = f"""<!doctype html>
<html><body style="font-family:monospace;padding:2rem">
<h2>✅ Authorization successful</h2>
<p>Add this as <code>SPOTIFY_REFRESH_TOKEN</code> in your Vercel environment variables:</p>
<code style="background:#f0f0f0;padding:1rem;display:block;word-break:break-all">{refresh_token}</code>
<p>Then redeploy your project.</p>
</body></html>"""
        self._respond(200, html)

    def _respond(self, status, html):
        body = html.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)
