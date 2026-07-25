import { HttpError } from '../utils/httpError.js';

export function validateBody(validator) {
  return (req, res, next) => {
    const errors = validator(req.body);
    if (errors.length > 0) {
      return next(new HttpError(400, errors.join(' ')));
    }
    return next();
  };
}
