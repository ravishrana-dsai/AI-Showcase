/**
 * Storage abstraction: local filesystem (dev) or S3/MinIO (production).
 *
 * Set S3_ENDPOINT in env to enable S3/MinIO mode.
 * Without it, files are read/written from the local uploads/ directory.
 */

import { join } from "path";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";

// S3 imports are only used when S3_ENDPOINT is configured
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const LOCAL_UPLOAD_BASE = join(process.cwd(), "../../uploads");

function getS3Client(): S3Client | null {
  const endpoint = process.env.S3_ENDPOINT;
  if (!endpoint) return null;

  return new S3Client({
    endpoint,
    region: process.env.S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "",
      secretAccessKey: process.env.S3_SECRET_KEY || "",
    },
    // Required for MinIO path-style access
    forcePathStyle: true,
  });
}

/**
 * Upload a file buffer. Returns the storage key used to retrieve it later.
 * Key format: "resumes/{uuid}.pdf"
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  mimeType: string
): Promise<string> {
  const s3 = getS3Client();

  if (s3) {
    const bucket = process.env.S3_BUCKET || "talent-hub-files";
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );
  } else {
    // Local fallback: write to uploads/ directory
    const localPath = join(LOCAL_UPLOAD_BASE, key);
    await mkdir(join(localPath, ".."), { recursive: true });
    await writeFile(localPath, buffer);
  }

  return key;
}

/**
 * Get a URL that can be used to serve a stored file.
 * S3: returns a presigned URL valid for 1 hour.
 * Local: returns the /api/files/... path (served by the files route).
 */
export async function getFileUrl(key: string): Promise<string> {
  const s3 = getS3Client();

  if (s3) {
    const bucket = process.env.S3_BUCKET || "talent-hub-files";
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(s3, command, { expiresIn: 3600 });
  }

  // Local: the files route serves at /api/files/<key>
  return `/api/files/${key}`;
}

/**
 * Read a stored file into a Buffer.
 * Used by the local file serving route (S3 mode uses presigned URLs instead).
 */
export async function getFileBuffer(key: string): Promise<Buffer> {
  const s3 = getS3Client();

  if (s3) {
    const bucket = process.env.S3_BUCKET || "talent-hub-files";
    const response = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  return readFile(join(LOCAL_UPLOAD_BASE, key));
}

/**
 * Delete a stored file.
 * Errors are logged but not re-thrown — GPlayer Rating deletion must not fail due to storage errors.
 */
export async function deleteFile(key: string): Promise<void> {
  const s3 = getS3Client();

  if (s3) {
    const bucket = process.env.S3_BUCKET || "talent-hub-files";
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (err) {
      console.error(`[Storage] Failed to delete S3 object ${key}:`, err);
    }
  } else {
    try {
      await unlink(join(LOCAL_UPLOAD_BASE, key));
    } catch (err) {
      // File may not exist — not an error
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`[Storage] Failed to delete local file ${key}:`, err);
      }
    }
  }
}
