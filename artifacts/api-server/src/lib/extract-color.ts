import { Vibrant } from "node-vibrant/node";
import { logger } from "./logger.js";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function isValidHex(c: string | undefined | null): c is string {
  return !!c && HEX_RE.test(c);
}

export async function extractDominantColor(imageUrl: string): Promise<string | null> {
  try {
    const palette = await Vibrant.from(imageUrl).getPalette();
    const candidates = [
      palette.Vibrant?.hex,
      palette.DarkVibrant?.hex,
      palette.Muted?.hex,
      palette.DarkMuted?.hex,
      palette.LightVibrant?.hex,
      palette.LightMuted?.hex,
    ];
    const color = candidates.find(isValidHex) ?? null;
    logger.info({ imageUrl, color }, "Extracted dominant color");
    return color;
  } catch (err: any) {
    logger.warn({ imageUrl, err: err?.message }, "Failed to extract dominant color");
    return null;
  }
}
