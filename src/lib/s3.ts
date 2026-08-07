import { S3Client } from "@aws-sdk/client-s3";

// Lazy on purpose: the rest of the app (auth, writing, publishing) must keep
// working even if S3 isn't configured yet — only image upload needs this,
// so only fail when an upload is actually attempted, not at server boot.
let client: S3Client | null = null;

export function getS3Region(): string {
  const region = process.env.AWS_REGION;
  if (!region) {
    throw new Error("AWS_REGION must be set to upload images.");
  }
  return region;
}

export function getS3Bucket(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET must be set to upload images.");
  }
  return bucket;
}

export function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client({ region: getS3Region() });
  }
  return client;
}
