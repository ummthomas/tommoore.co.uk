export default async function handler(req, res) {
  const { code, error } = req.query;
  if (error || !code) return res.status(400).send(`Error: ${error || 'no code'}`);

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
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) return res.status(500).send(`Token error: ${JSON.stringify(data)}`);

  res.send(`
    <h2>✅ Success</h2>
    <p>Add this as <code>SPOTIFY_REFRESH_TOKEN</code> in Vercel environment variables:</p>
    <code style="background:#f0f0f0;padding:1rem;display:block;word-break:break-all">${data.refresh_token}</code>
    <p>Then redeploy.</p>
  `);
}
