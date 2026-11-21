/**
 * File upload middleware (Multer).
 *
 * We keep uploads in MEMORY (not on disk) because the storage adapter decides
 * where they finally go (local folder or S3). This gives us a Buffer we can
 * hand straight to `storage.upload()`.
 *
 * Security:
 *   - We restrict the allowed MIME types (first-line filter).
 *   - We cap the file size via limits.
 *   - The real extension used for the saved file is derived from the MIME type
 *     inside the storage adapter, never from the user's filename.
 */
import multer from 'multer';
import { env } from '../config/env';
import { ApiError } from '../utils/api-error';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE_BYTES,
    files: 10, // max images per request
  },
  fileFilter(_req, file, callback) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(ApiError.badRequest('Only JPEG, PNG, WEBP, or GIF images are allowed'));
    }
  },
});
