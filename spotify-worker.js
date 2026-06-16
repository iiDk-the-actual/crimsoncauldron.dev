// Cloudflare Worker — Spotify now playing proxy
// Deploy at: https://dash.cloudflare.com → Workers → Create
//
// Set these secrets via: wrangler secret put <NAME>  or the dashboard UI
//   SPOTIFY_CLIENT_ID
//   SPOTIFY_CLIENT_SECRET
//   SPOTIFY_REFRESH_TOKEN

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    try {
      // Exchange refresh token for access token
      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`),
        },
        body: `grant_type=refresh_token&refresh_token=${env.SPOTIFY_REFRESH_TOKEN}`,
      });

      const { access_token } = await tokenRes.json();

      // Fetch currently playing
      const nowRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { 'Authorization': `Bearer ${access_token}` },
      });

      // 204 = nothing playing
      if (nowRes.status === 204 || nowRes.status === 404) {
        return new Response(JSON.stringify({ playing: false }), { headers: CORS });
      }

      const data = await nowRes.json();

      if (!data?.item || data.currently_playing_type !== 'track') {
        return new Response(JSON.stringify({ playing: false }), { headers: CORS });
      }

      return new Response(JSON.stringify({
        playing:   data.is_playing,
        title:     data.item.name,
        artist:    data.item.artists.map(a => a.name).join(', '),
        album:     data.item.album.name,
        art:       data.item.album.images[1]?.url ?? data.item.album.images[0]?.url,
        url:       data.item.external_urls.spotify,
        progress:  data.progress_ms,
        duration:  data.item.duration_ms,
      }), { headers: CORS });

    } catch (e) {
      return new Response(JSON.stringify({ playing: false, error: e.message }), {
        status: 500,
        headers: CORS,
      });
    }
  },
};
