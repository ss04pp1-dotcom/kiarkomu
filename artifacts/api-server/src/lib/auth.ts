import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";

const SECRET = process.env["SESSION_SECRET"] ?? "";

function getSecret(): string {
  if (!SECRET) {
    throw new Error("SESSION_SECRET environment variable is not set. Please configure it.");
  }
  return SECRET;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Google-only accounts cannot authenticate via password
  if (hash.startsWith("google:")) return false;
  return bcrypt.compare(password, hash);
}

export function signToken(payload: { userId: number; role: string }): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "30d" });
}

export function verifyToken(token: string): { userId: number; role: string } {
  return jwt.verify(token, getSecret()) as { userId: number; role: string };
}

// Generate a cryptographically random 8-character uppercase referral code
// to reduce collision probability compared to Math.random()
export function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}
