import os
import urllib.parse
from http.server import BaseHTTPRequestHandler

CLIENT_ID = os.environ.get("SPOTIFY_CLIENT_ID", "")
REDIRECT_URI = os.environ.get("SPOTIFY_REDIRECT_URI", "")
SCOPE = "user-read-currently-playing user-read-playback-state"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = urllib.parse.urlencode({
            "client_id": CLIENT_ID,
            "response_type": "code",
            "redirect_uri": REDIRECT_URI,
            "scope": SCOPE,
        })
        url = f"https://accounts.spotify.com/authorize?{params}"
        self.send_response(302)
        self.send_header("Location", url)
        self.end_headers()
