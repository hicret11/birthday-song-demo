import path from "node:path";
import type { ShareTemplate } from "./api-types";

export type TemplateTypography = {
  fontPath: string;
  fontSize: number;
  fontColor: string;
  borderColor?: string;
  borderWidth?: number;
  shadowColor?: string;
  shadowX?: number;
  shadowY?: number;
};

const FONTS_DIR = path.join(process.cwd(), "public", "video-fonts");
const SERIF = path.join(FONTS_DIR, "PlayfairDisplay-Bold.ttf");
const SANS = path.join(FONTS_DIR, "Inter-Bold.ttf");

export const TEMPLATE_TYPOGRAPHY: Record<ShareTemplate, TemplateTypography> = {
  classic: {
    fontPath: SERIF,
    fontSize: 90,
    fontColor: "#1f2937",
    borderColor: "#faf7f2",
    borderWidth: 4,
  },
  elegant: {
    fontPath: SERIF,
    fontSize: 90,
    fontColor: "#f5e070",
    shadowColor: "#000000",
    shadowX: 2,
    shadowY: 3,
  },
  neon: {
    fontPath: SANS,
    fontSize: 96,
    fontColor: "#ff66ff",
    borderColor: "#3a0a3a",
    borderWidth: 3,
    shadowColor: "#ff00ff",
    shadowX: 0,
    shadowY: 0,
  },
  playful: {
    fontPath: SANS,
    fontSize: 100,
    fontColor: "#ffffff",
    shadowColor: "#000000",
    shadowX: 3,
    shadowY: 3,
  },
};

export const TEMPLATE_VIDEO_DIR = path.join(process.cwd(), "public", "video-templates");

export function templateVideoPath(template: ShareTemplate): string {
  return path.join(TEMPLATE_VIDEO_DIR, `${template}.mp4`);
}
