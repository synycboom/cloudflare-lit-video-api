import { Router } from 'itty-router';
import { NETWORK_PUB_KEY } from 'lit-js-sdk/src/lib/constants';
import { verify } from 'noble-bls12-381';
import { isAuthenticated } from './authentication';
import { handleOptions } from './request';
import { addMinutesToNow } from './util';

const UPLOAD_TIMEOUT_IN_MINUTES = 5;
const UPLOAD_MAX_DURATION = 3600;
const VIDEO_KEY = 'videos';

const getCorsHeader = () => {
  return {
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  };
}

const userVideoCountKey = (wallet) => {
  return `users:${wallet}:videos`;
}

const getVideoCounter = async (wallet) => {
  return parseInt(await KV.get(userVideoCountKey(wallet))) || 0;
}

const increaseVideoCounter = async (wallet) => {
  const counter = await getVideoCounter(wallet);
  await KV.put(userVideoCountKey(wallet), counter+1);
}

const router = Router();

router.get('/kv/videos', async () => {
  let videos = [];

  try {
    const res = await KV.get(VIDEO_KEY)
    if (res) {
      videos = JSON.parse(res);
    }
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
    }), {
      headers: getCorsHeader(),
      status: 500,
    });
  }

  return new Response(JSON.stringify({
    data: videos,
  }), {
    headers: getCorsHeader(),
  });
});

router.post('/kv/videos', isAuthenticated, async (request) => {
  try {
    const count = await getVideoCounter(request.wallet);
    const content = await request.json();
    if (count > MAX_VIDEOS) {
      return new Response(JSON.stringify({
        error: "You have reach your upload limit.",
      }), {
        headers: getCorsHeader(),
        status: 400,
      });
    }

    const res = await KV.get(VIDEO_KEY);
    let videos = [];
    if (res) {
      videos = JSON.parse(res);
    }

    content.wallet = request.wallet; 
    videos.push(content);

    await KV.put(VIDEO_KEY, JSON.stringify(videos));
    await increaseVideoCounter(request.wallet);
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
    }), {
      headers: getCorsHeader(),
      status: 500,
    });
  }

  return new Response('ok', {
    headers: getCorsHeader(),
  });
});

router.get('/videos/presigned-url', isAuthenticated, async (request) => {
  const jwt = request.headers.get('x-lit-jwt');
  const signedUrlRestrictions = {
    //limit viewing for the next 12 hours
    exp: Math.floor(Date.now() / 1000) + (12*60*60) 
  };
  const pubKey = Buffer.from(NETWORK_PUB_KEY, 'hex');
  const jwtParts = jwt.split(".");
  const signature = Buffer.from(jwtParts[2], 'base64');
  const unsignedJwt = `${jwtParts[0]}.${jwtParts[1]}`;
  const message = Buffer.from(unsignedJwt);
  const verified = await verify(signature, message, pubKey);
  const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString());
  if (!verified) {
    return new Response('Unauthorized request', {
      headers: getCorsHeader(),
      status: 401,
    });
  }

  const { videoId } = JSON.parse(payload.extraData);
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/${videoId}/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify(signedUrlRestrictions),
  });

  return new Response(response.body, {
    headers: getCorsHeader(),
  });
});

router.get('/videos/:id', isAuthenticated, async ({ params }) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/${params.id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
    },
  });

  return new Response(response.body, {
    headers: getCorsHeader(),
  });
});

router.get('/upload/link', isAuthenticated, async (request) => {
  const count = await getVideoCounter(request.wallet);
  if (count > MAX_VIDEOS) {
    return new Response(JSON.stringify({
      error: "You have reach your upload limit.",
    }), {
      headers: getCorsHeader(),
      status: 400,
    });
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/direct_upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({
      maxDurationSeconds: UPLOAD_MAX_DURATION,
      expiry: addMinutesToNow(UPLOAD_TIMEOUT_IN_MINUTES).toISOString(),
      requireSignedURLs: true,
      allowedOrigins: [ALLOWED_ORIGIN.replace('https://', '').replace('http://', '')],
      thumbnailTimestampPct: 0.568427
    }),
  });

  return new Response(response.body, {
    headers: getCorsHeader(),
  });
});

router.options('*', request => {
  return handleOptions(request);
});

router.all('*', () => new Response('404, not found!', { status: 404 }));

addEventListener('fetch', (e) => {
  e.respondWith(router.handle(e.request));
});
