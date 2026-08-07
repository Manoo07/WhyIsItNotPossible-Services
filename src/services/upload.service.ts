import path from "path";
import fs from "fs";
import multer from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getS3Bucket, getS3Region } from "../lib/s3.js";

// Legacy local-disk directory — kept only so files uploaded before the S3
// migration keep working via serveUpload(); nothing new is written here.
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

function buildObjectKey(originalname: string) {
  const ext = path.extname(originalname);
  return `posts/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
}

export async function uploadToS3(file: Express.Multer.File): Promise<string> {
  const bucket = getS3Bucket();
  const region = getS3Region();
  const key = buildObjectKey(file.originalname);
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

// Legacy: serves files uploaded before the S3 migration.
export function resolveUploadPath(filename: string) {
  return path.join(uploadDir, path.basename(filename));
}

export function uploadExists(filename: string) {
  return fs.existsSync(resolveUploadPath(filename));
}
