import { env } from '../config/env.js';
import { verifyFirebaseToken, hasFirebaseAdmin } from '../config/firebaseAdmin.js';
import { HttpError } from '../utils/httpError.js';

export async function authMiddleware(req, res, next) {
  if (!env.requireAuth) {
    req.user = null;
    return next();
  }

  if (!hasFirebaseAdmin) {
    return next(
      new HttpError(
        500,
        'Server authentication is enabled but Firebase Admin credentials are missing.'
      )
    );
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Missing or invalid Authorization header.'));
  }

  const idToken = authHeader.slice('Bearer '.length);

  try {
    const decoded = await verifyFirebaseToken(idToken);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || '',
    };
    return next();
  } catch (error) {
    return next(new HttpError(401, 'Invalid Firebase authentication token.'));
  }
}
