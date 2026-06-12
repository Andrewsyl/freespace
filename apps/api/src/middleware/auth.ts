import { NextFunction, Request, Response } from "express";
import { JwtPayload, verifyToken } from "../lib/auth.js";

declare global {
  namespace Express {
    // Inject authenticated user details onto the request once verified.
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header && header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    try {
      req.user = verifyToken(token);
    } catch {
      // Invalid token — treat as unauthenticated, don't reject
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = header.slice(7).trim();
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
