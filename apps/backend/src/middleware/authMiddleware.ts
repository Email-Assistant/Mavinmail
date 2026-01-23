import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

// Valid roles in the system (3-tier hierarchy)
export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

// This is the shape of the data encoded in our JWT. The ID from the User model is a number.
export interface TokenPayload extends JwtPayload {
  userId: number;
  role: UserRole;
}

// This is the single, unified custom request type for the entire application.
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload; // The 'user' property will hold our decoded token payload.
}

// This is the single, unified authentication middleware function.
// We are naming it `authMiddleware` to match what your other features are likely using.
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: 'Authentication token is required.' });
  }

  jwt.verify(token, JWT_SECRET, (error, payload) => {
    if (error) {
      console.error('JWT Verification Error:', error.message);
      return res.status(403).json({ message: 'Token is invalid or has expired.' });
    }

    // We cast the request to our custom type and attach the decoded payload.
    (req as AuthenticatedRequest).user = payload as TokenPayload;

    next();
  });
};