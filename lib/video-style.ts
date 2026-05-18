import type { ShareTemplate } from "./api-types";

const R2_TEMPLATE_BASE = "https://pub-4a5a0d0e9e504b74a6c9751524055c49.r2.dev/templates";

const TEMPLATE_URLS: Record<ShareTemplate, string> = {
  classic: `${R2_TEMPLATE_BASE}/classic-60s.mp4`,
  elegant: `${R2_TEMPLATE_BASE}/elegant-60s.mp4`,
  neon: `${R2_TEMPLATE_BASE}/neon-60s.mp4`,
  playful: `${R2_TEMPLATE_BASE}/playful-60s.mp4`,
};

export function templateVideoPath(template: ShareTemplate): string {
  return TEMPLATE_URLS[template];
}
