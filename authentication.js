import jwt from 'jsonwebtoken';
import jwkToPem from 'jwk-to-pem';
const ethUtil = require('ethereumjs-util');

// Improvement: we use this url as a workaround solution
const JWKS_URL = 'https://auth.unstoppabledomains.com/keys';

const verifyIdToken = async (
  rawIdToken,
  nonce,
) => {
  const response = await fetch(JWKS_URL);
  const { keys } = await response.json();
  const secretOrPublicKey = (header, cb) => {
    const key = keys.find(k => k.kid === header.kid);
    if (key) {
      cb(null, jwkToPem(key));

      return
    }

    throw new Error(`Unable to find a signing key that matches '${header.kid}'`);
  };
  const idToken = await new Promise((resolve, reject) => {
    jwt.verify(rawIdToken, secretOrPublicKey, {}, (error, decoded) => {
      if (error) {
        reject(error);
      }

      resolve(decoded);
    })
  })

  idToken.__raw = rawIdToken

  if (nonce !== idToken.nonce) {
    throw new Error("nonces don't match");
  }

  return idToken;
};

export const isAuthenticated = async (request) => {
  // Unstoppable
  const rawJwt = request.headers.get('x-auth-jwt');
  const nonce = request.headers.get('x-auth-nonce');
  if (rawJwt && nonce) {
    const jwt = await verifyIdToken(rawJwt, nonce);
    request.wallet = jwt.wallet_address.toLowerCase();

    return;
  }

  // Metamask
  const message = request.headers.get('x-auth-message');
  const signature = request.headers.get('x-auth-signature');
  const wallet = request.headers.get('x-auth-wallet');
  if (message && signature && wallet) {
    const { v, r, s } = ethUtil.fromRpcSig(signature);
    const msgHash = ethUtil.hashPersonalMessage(Buffer.from(message));
    const publicKey = ethUtil.ecrecover(msgHash, v, r, s);
    const address = `0x${ethUtil.pubToAddress(publicKey).toString('hex')}`;
    if (address.toLowerCase() === wallet.toLowerCase()) {
      request.wallet = address;

      return;
    }
  }

  return new Response('Not Authenticated', { status: 401 })
};
