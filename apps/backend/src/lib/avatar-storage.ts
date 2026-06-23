import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { MultipartFile } from '@fastify/multipart';

export const AVATAR_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'] as const;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2MB

function extForMime(m: string): string {
  if (m === 'image/png') return '.png';
  if (m === 'image/webp') return '.webp';
  return '.jpg';
}

/** PNG / JPEG / WebP magic bytes. */
function looksLikeAllowedImage(buffer: Buffer, claimedMime: string): boolean {
  if (buffer.length < 12) return false;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  // RIFF....WEBP
  const isWebp =
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  if (claimedMime === 'image/png') return isPng;
  if (claimedMime === 'image/jpeg' || claimedMime === 'image/jpg') return isJpeg;
  if (claimedMime === 'image/webp') return isWebp;
  return isPng || isJpeg || isWebp;
}

/** Web-accessible avatar dir under the frontend public folder (served statically by Next.js). */
export function getAvatarDir(): string {
  return path.resolve(process.cwd(), '../frontend/public/assets/upload/avatars');
}

/** Filename-only guard (no path traversal). */
export function avatarFilenameFromUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  const prefix = '/assets/upload/avatars/';
  if (!url.startsWith(prefix)) return null;
  const name = url.slice(prefix.length);
  if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) return null;
  return name;
}

/**
 * Validate + persist an uploaded avatar. Returns the public URL (relative to the frontend origin).
 */
export async function saveAvatarFromMultipart(
  userId: string,
  file: MultipartFile
): Promise<{ avatarUrl: string; byteLength: number }> {
  if (!AVATAR_MIMES.includes(file.mimetype as (typeof AVATAR_MIMES)[number])) {
    throw new Error('INVALID_IMAGE_TYPE');
  }
  const buf = await file.toBuffer();
  if (buf.length > AVATAR_MAX_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }
  if (buf.length === 0) {
    throw new Error('EMPTY_FILE');
  }
  if (!looksLikeAllowedImage(buf, file.mimetype)) {
    throw new Error('INVALID_IMAGE_CONTENT');
  }

  const ext = extForMime(file.mimetype);
  // Hash userId to avoid leaking the raw id in the public path, plus a short random suffix for cache busting.
  const userHash = crypto.createHash('sha256').update(userId).digest('hex').slice(0, 16);
  const filename = `${userHash}-${crypto.randomUUID().slice(0, 8)}${ext}`;

  const uploadDir = getAvatarDir();
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const filepath = path.join(uploadDir, filename);
  await fs.promises.writeFile(filepath, buf);

  return { avatarUrl: `/assets/upload/avatars/${filename}`, byteLength: buf.length };
}

/** Best-effort delete of a previously stored avatar file. */
export async function deleteAvatarFile(url: string | null | undefined): Promise<void> {
  const name = avatarFilenameFromUrl(url);
  if (!name) return;
  try {
    await fs.promises.unlink(path.join(getAvatarDir(), name));
  } catch {
    /* best-effort */
  }
}
