import base64
import json
import os
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler

CLIENT_ID = os.environ.get("SPOTIFY_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("SPOTIFY_CLIENT_SECRET", "")
REFRESH_TOKEN = os.environ.get("SPOTIFY_REFRESH_TOKEN", "")


def get_access_token():
    credentials = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    data = urllib.parse.urlencode({
        "grant_type": "refresh_token",
        "refresh_token": REFRESH_TOKEN,
    }).encode()
    req = urllib.request.Request(
        "https://accounts.spotify.com/api/token",
        data=data,
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())["access_token"]


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            access_token = get_access_token()
        except Exception as e:
            self._json(500, {"error": f"Token refresh failed: {e}"})
            return

        req = urllib.request.Request(
            "https://api.spotify.com/v1/me/player/currently-playing",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        try:
            with urllib.request.urlopen(req) as resp:
                if resp.status == 204:
                    self._json(200, {"isPlaying": False})
                    return
                data = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 204:
                self._json(200, {"isPlaying": False})
                return
            self._json(e.code, {"error": str(e)})
            return

        item = data.get("item")
        if not item:
            self._json(200, {"isPlaying": False})
            return

        self._json(200, {
            "isPlaying": data.get("is_playing", False),
            "title": item["name"],
            "artist": ", ".join(a["name"] for a in item["artists"]),
            "albumArt": item["album"]["images"][0]["url"] if item["album"]["images"] else None,
            "songUrl": item["external_urls"].get("spotify"),
        })

    def _json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)
