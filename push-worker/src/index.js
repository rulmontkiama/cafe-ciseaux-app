/**
 * Cloudflare Worker — Notifications Push gratuites (FCM HTTP v1) pour Café Ciseaux.
 *
 * - Aucun secret dans le code source : FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY
 *   sont stockés dans les Secrets chiffrés Cloudflare Workers.
 * - Vérifie cryptographiquement (RS256) le jeton Firebase Auth ID de l'expéditeur.
 * - Vérifie côté Firestore qu'au moins l'expéditeur ou le destinataire est administrateur
 *   (empêche tout spam entre deux clients).
 * - Envoie les notifications push via FCM HTTP v1 (100 % gratuit sur le plan Firebase Spark)
 *   et nettoie automatiquement les jetons expirés/désinstallés en arrière-plan.
 */

const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPES =
  'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging';

const ALLOWED_ORIGINS = new Set([
  'https://cafe-ciseaux-e342d.web.app',
  'https://cafe-ciseaux-e342d.firebaseapp.com',
  'capacitor://localhost',
  'ionic://localhost',
  'https://localhost',
  'http://localhost',
  'http://localhost:4200',
  'http://127.0.0.1:4200',
]);

const UID_REGEX = /^[A-Za-z0-9_-]{1,128}$/;

// Caches en mémoire dans l'isolat (réduisent drastiquement la latence et les appels réseau)
let cachedJwks = null;
let cachedJwksExpiresAt = 0;

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;
let cachedSigningKey = null;
let cachedSigningKeyPem = null;

function buildCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function jsonResponse(request, status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...buildCorsHeaders(request),
    },
  });
}

function base64UrlToUint8Array(input) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function textToBase64Url(text) {
  return uint8ArrayToBase64Url(new TextEncoder().encode(text));
}

async function fetchGoogleJwks(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedJwks && now < cachedJwksExpiresAt) {
    return cachedJwks;
  }
  const resp = await fetch(GOOGLE_JWKS_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch Google JWKS (${resp.status})`);
  }
  const data = await resp.json();
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  const cc = resp.headers.get('Cache-Control') || '';
  const maxAgeMatch = cc.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Math.min(Number(maxAgeMatch[1]), 21600) : 3600;
  cachedJwks = keys;
  cachedJwksExpiresAt = now + maxAgeSec * 1000;
  return keys;
}

async function verifyFirebaseIdToken(idToken, projectId) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(headerB64)));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(payloadB64)));

  if (header?.alg !== 'RS256' || typeof header?.kid !== 'string' || !header.kid) {
    throw new Error('Unsupported JWT algorithm or missing kid');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;

  if (payload?.aud !== projectId) {
    throw new Error('Invalid aud');
  }
  if (payload?.iss !== expectedIssuer) {
    throw new Error('Invalid iss');
  }
  if (typeof payload?.sub !== 'string' || !UID_REGEX.test(payload.sub)) {
    throw new Error('Invalid sub');
  }
  if (typeof payload?.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Token expired');
  }
  if (typeof payload?.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Invalid iat');
  }

  let keys = await fetchGoogleJwks(false);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await fetchGoogleJwks(true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) {
    throw new Error('Signing key not found');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToUint8Array(signatureB64);

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signature,
    signingInput
  );
  if (!valid) {
    throw new Error('Invalid JWT signature');
  }

  return payload;
}

async function importServiceAccountKey(pemRaw) {
  if (cachedSigningKey && cachedSigningKeyPem === pemRaw) {
    return cachedSigningKey;
  }
  const normalized = String(pemRaw || '').replace(/\\n/g, '\n').trim();
  const base64Body = normalized
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(base64Body);
  const der = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    der[i] = binary.charCodeAt(i);
  }
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  cachedSigningKey = key;
  cachedSigningKeyPem = pemRaw;
  return key;
}

async function getGoogleAccessToken(env) {
  const now = Date.now();
  if (cachedAccessToken && now < cachedAccessTokenExpiresAt) {
    return cachedAccessToken;
  }

  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error('Missing Firebase service account secrets');
  }

  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;
  const headerB64 = textToBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimB64 = textToBase64Url(
    JSON.stringify({
      iss: env.FIREBASE_CLIENT_EMAIL,
      scope: GOOGLE_SCOPES,
      aud: GOOGLE_TOKEN_URL,
      iat,
      exp,
    })
  );

  const signingInput = new TextEncoder().encode(`${headerB64}.${claimB64}`);
  const privateKey = await importServiceAccountKey(env.FIREBASE_PRIVATE_KEY);
  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, signingInput);
  const assertion = `${headerB64}.${claimB64}.${uint8ArrayToBase64Url(new Uint8Array(sigBuf))}`;

  const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text().catch(() => '');
    throw new Error(`OAuth2 token exchange failed (${tokenResp.status}): ${errText.slice(0, 200)}`);
  }

  const tokenJson = await tokenResp.json();
  cachedAccessToken = tokenJson.access_token;
  const expiresInSec = Number(tokenJson.expires_in) || 3600;
  cachedAccessTokenExpiresAt = now + Math.max(60, expiresInSec - 180) * 1000;
  return cachedAccessToken;
}

async function firestoreBatchGet(projectId, accessToken, docPaths) {
  const prefix = `projects/${projectId}/databases/(default)/documents/`;
  const url = `https://firestore.googleapis.com/v1/${prefix.slice(0, -1)}:batchGet`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      documents: docPaths.map((p) => `${prefix}${p}`),
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Firestore batchGet failed (${resp.status}): ${errText.slice(0, 200)}`);
  }

  const items = await resp.json();
  const byPath = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (item?.found?.name) {
      const rel = item.found.name.startsWith(prefix)
        ? item.found.name.slice(prefix.length)
        : item.found.name;
      byPath.set(rel, item.found.fields || {});
    }
  }
  return byPath;
}

function readStringField(fields, key) {
  return typeof fields?.[key]?.stringValue === 'string' ? fields[key].stringValue.trim() : '';
}

function readStringArrayField(fields, key) {
  const values = fields?.[key]?.arrayValue?.values;
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  for (const entry of values) {
    const v = typeof entry?.stringValue === 'string' ? entry.stringValue.trim() : '';
    if (v && v.length <= 512) {
      unique.add(v);
    }
  }
  return Array.from(unique).slice(0, 10);
}

function capitalizeWord(str) {
  if (!str) return '';
  return str
    .split(/(\s+|-)/)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join('');
}

function formatSenderName(senderFields) {
  const prenom = capitalizeWord(readStringField(senderFields, 'prenom'));
  const nom = capitalizeWord(readStringField(senderFields, 'nom'));
  const full = `${prenom} ${nom}`.trim();
  return full || 'Un client';
}

function sanitizePreview(raw) {
  const cleaned = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Nouveau message';
  if (cleaned.length <= 140) return cleaned;
  return `${cleaned.slice(0, 139)}…`;
}

async function sendFcmNotification(projectId, accessToken, token, notification, data) {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification,
        data,
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert',
          },
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        android: {
          priority: 'HIGH',
          notification: {
            sound: 'default',
            channel_id: 'messages',
          },
        },
      },
    }),
  });

  if (resp.ok) {
    return { ok: true, deadToken: false };
  }

  let errJson = null;
  try {
    errJson = await resp.json();
  } catch {
    errJson = null;
  }

  const details = Array.isArray(errJson?.error?.details) ? errJson.error.details : [];
  const fcmErrorCode = details.find((d) => d?.errorCode)?.errorCode || '';
  const statusStr = String(errJson?.error?.status || '');
  const messageStr = String(errJson?.error?.message || '');

  const isDead =
    fcmErrorCode === 'UNREGISTERED' ||
    (resp.status === 404 && statusStr === 'NOT_FOUND') ||
    (resp.status === 400 && messageStr.toLowerCase().includes('not a valid fcm registration token'));

  return {
    ok: false,
    deadToken: isDead,
    status: resp.status,
    code: fcmErrorCode || statusStr || 'UNKNOWN',
  };
}

async function removeDeadTokensFromUser(projectId, accessToken, uid, deadTokens) {
  if (!deadTokens.length) return;
  const docName = `projects/${projectId}/databases/(default)/documents/users/${uid}`;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      writes: [
        {
          transform: {
            document: docName,
            fieldTransforms: [
              {
                fieldPath: 'fcmTokens',
                removeAllFromArray: {
                  values: deadTokens.map((t) => ({ stringValue: t })),
                },
              },
            ],
          },
        },
      ],
    }),
  }).catch(() => {});
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: buildCorsHeaders(request) });
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return jsonResponse(request, 200, {
        ok: true,
        service: 'cafe-ciseaux-push',
        configured: Boolean(env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY),
      });
    }

    if (request.method !== 'POST' || url.pathname !== '/notify-message') {
      return jsonResponse(request, 404, { ok: false, error: 'not_found' });
    }

    const projectId = env.FIREBASE_PROJECT_ID || 'cafe-ciseaux-e342d';

    // 1. Authentification Firebase obligatoire
    const authHeader = request.headers.get('Authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return jsonResponse(request, 401, { ok: false, error: 'missing_token' });
    }

    let decoded;
    try {
      decoded = await verifyFirebaseIdToken(match[1].trim(), projectId);
    } catch {
      return jsonResponse(request, 401, { ok: false, error: 'invalid_token' });
    }

    const senderUid = decoded.sub;

    // 2. Lecture et validation du payload JSON
    let body;
    try {
      const raw = await request.text();
      if (raw.length > 8192) {
        return jsonResponse(request, 413, { ok: false, error: 'payload_too_large' });
      }
      body = JSON.parse(raw);
    } catch {
      return jsonResponse(request, 400, { ok: false, error: 'invalid_json' });
    }

    const toUid = typeof body?.toUid === 'string' ? body.toUid.trim() : '';
    if (!UID_REGEX.test(toUid)) {
      return jsonResponse(request, 400, { ok: false, error: 'invalid_recipient' });
    }
    if (toUid === senderUid) {
      return jsonResponse(request, 200, { ok: true, sent: 0, reason: 'self_message' });
    }

    const preview = sanitizePreview(body?.preview);

    // 3. Accès Firestore & vérification des rôles (Admin ↔ Client uniquement)
    try {
      const accessToken = await getGoogleAccessToken(env);
      const docs = await firestoreBatchGet(projectId, accessToken, [
        `users/${toUid}`,
        `users/${senderUid}`,
        `admin/${senderUid}`,
        `admin/${toUid}`,
      ]);

      const senderIsAdmin = docs.has(`admin/${senderUid}`);
      const recipientIsAdmin = docs.has(`admin/${toUid}`);

      if (!senderIsAdmin && !recipientIsAdmin) {
        return jsonResponse(request, 403, { ok: false, error: 'forbidden_conversation' });
      }

      const recipientFields = docs.get(`users/${toUid}`);
      const tokens = readStringArrayField(recipientFields, 'fcmTokens');
      if (tokens.length === 0) {
        return jsonResponse(request, 200, { ok: true, sent: 0, reason: 'no_tokens' });
      }

      const senderFields = docs.get(`users/${senderUid}`);
      const title = senderIsAdmin
        ? 'Café Ciseaux'
        : `Message · ${formatSenderName(senderFields)}`;

      const notification = {
        title,
        body: preview,
      };
      const data = {
        type: 'message',
        fromUid: senderUid,
        route: recipientIsAdmin ? '/admin/admin-message' : '/user-message',
      };

      const results = await Promise.all(
        tokens.map(async (token) => ({
          token,
          ...(await sendFcmNotification(projectId, accessToken, token, notification, data)),
        }))
      );

      const sent = results.filter((r) => r.ok).length;
      const failed = results.length - sent;
      const deadTokens = results.filter((r) => r.deadToken).map((r) => r.token);
      const errorCodes = results.filter((r) => !r.ok).map((r) => `${r.status}:${r.code}`);

      console.log(
        JSON.stringify({
          event: 'fcm_dispatch',
          tokens: tokens.length,
          sent,
          failed,
          cleaned: deadTokens.length,
          errorCodes,
        })
      );

      if (deadTokens.length > 0) {
        ctx.waitUntil(removeDeadTokensFromUser(projectId, accessToken, toUid, deadTokens));
      }

      return jsonResponse(request, 200, {
        ok: true,
        sent,
        failed,
        cleaned: deadTokens.length,
      });
    } catch (err) {
      console.error('[cafe-ciseaux-push] error:', err?.message || err);
      return jsonResponse(request, 500, { ok: false, error: 'push_delivery_error' });
    }
  },
};
