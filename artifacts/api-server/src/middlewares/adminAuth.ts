import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AdminRequest extends Request {
  adminEmail?: string;
}

export function adminAuth(req: AdminRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const secret = process.env["ADMIN_JWT_SECRET"];
  if (!secret) {
    res.status(500).json({ error: "Server misconfigured: ADMIN_JWT_SECRET missing" });
    return;
  }
  try {
    const payload = jwt.verify(auth.slice(7), secret) as { email: string };

    (async () => {
      try {
        const { pool } = await import("@workspace/db");
        const { rows } = await pool.query<{ role: string }>(
          `SELECT role FROM users WHERE email = $1 AND is_active = true LIMIT 1`,
          [payload.email]
        );
        if (!rows[0] || !["owner", "manager"].includes(rows[0].role)) {
          res.status(403).json({ error: "Forbidden: insufficient role" });
          return;
        }
        req.adminEmail = payload.email;
        next();
      } catch {
        res.status(500).json({ error: "Auth verification failed" });
      }
    })();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
