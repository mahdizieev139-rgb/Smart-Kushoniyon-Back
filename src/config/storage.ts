/**
 * Object storage abstraction.
 *
 * The rest of the app never talks to S3 or the filesystem directly. It uses
 * this `storage` object, which hides WHERE files live. Today we support:
 *
 *   - "local": writes files to a folder on disk (great for development).
 *   - "s3":    writes to any S3-compatible bucket (AWS S3, MinIO, R2, ...).
 *
 * Swapping drivers is just an environment variable change — no code changes.
 * This is the Strategy pattern: one interface, interchangeable implementations.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from './env';
import { logger } from './logger';

export interface UploadInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  // Logical folder inside storage, e.g. "products". No leading/trailing slash.
  folder: string;
}

export interface UploadResult {
  // The object key/path inside storage (used later to delete the file).
  storageKey: string;
  // The public URL clients use to display the image.
  imageUrl: string;
}

export interface StorageAdapter {
  upload(input: UploadInput): Promise<UploadResult>;
  delete(storageKey: string): Promise<void>;
}

// Map common image MIME types to safe file extensions. We derive the extension
// from the validated MIME type, NOT from the user's filename, to avoid tricks
// like "evil.php.jpg".
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function buildObjectKey(folder: string, mimeType: string): string {
  const extension = EXTENSION_BY_MIME[mimeType] ?? 'bin';
  // Random name prevents collisions and guessing of other users' files.
  return `${folder}/${randomUUID()}.${extension}`;
}

// --- Local filesystem adapter (development) ------------------------------
class LocalStorageAdapter implements StorageAdapter {
  private readonly baseDir = path.resolve(process.cwd(), env.LOCAL_STORAGE_DIR);

  async upload(input: UploadInput): Promise<UploadResult> {
    const storageKey = buildObjectKey(input.folder, input.mimeType);
    const fullPath = path.join(this.baseDir, storageKey);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);

    const imageUrl = `${env.LOCAL_STORAGE_PUBLIC_URL.replace(/\/$/, '')}/${storageKey}`;
    return { storageKey, imageUrl };
  }

  async delete(storageKey: string): Promise<void> {
    const fullPath = path.join(this.baseDir, storageKey);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      // Deleting an already-missing file is not an error worth crashing over.
      logger.warn({ storageKey, error }, 'Local storage: file not found while deleting');
    }
  }
}

// --- S3-compatible adapter (production) ----------------------------------
class S3StorageAdapter implements StorageAdapter {
  private readonly client = new S3Client({
    endpoint: env.STORAGE_ENDPOINT || undefined,
    region: env.STORAGE_REGION,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY,
      secretAccessKey: env.STORAGE_SECRET_KEY,
    },
    // Needed by MinIO and some S3-compatible providers.
    forcePathStyle: true,
  });

  async upload(input: UploadInput): Promise<UploadResult> {
    const storageKey = buildObjectKey(input.folder, input.mimeType);

    await this.client.send(
      new PutObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: storageKey,
        Body: input.buffer,
        ContentType: input.mimeType,
      }),
    );

    const base = (env.STORAGE_PUBLIC_URL || `${env.STORAGE_ENDPOINT}/${env.STORAGE_BUCKET}`).replace(/\/$/, '');
    return { storageKey, imageUrl: `${base}/${storageKey}` };
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: storageKey }),
    );
  }
}

// Pick the adapter once, at startup, based on configuration.
export const storage: StorageAdapter =
  env.STORAGE_DRIVER === 's3' ? new S3StorageAdapter() : new LocalStorageAdapter();

logger.info({ driver: env.STORAGE_DRIVER }, 'Storage adapter initialized');
