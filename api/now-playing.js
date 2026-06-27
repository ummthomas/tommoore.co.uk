async function getAccessToken() {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
    }),
  });

  const data = await resp.json();
  return data.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const accessToken = await getAccessToken();
    const resp = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (resp.status === 204) return res.json({ isPlaying: false });

    const data = await resp.json();
    if (!data.item) return res.json({ isPlaying: false });

    res.json({
      isPlaying: data.is_playing,
      title: data.item.name,
      artist: data.item.artists.map(a => a.name).join(', '),
      albumArt: data.item.album.images[0]?.url ?? null,
      songUrl: data.item.external_urls.spotify,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
