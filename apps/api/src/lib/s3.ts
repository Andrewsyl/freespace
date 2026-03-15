import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const AWS_REGION = process.env.AWS_REGION?.trim() ?? "";
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME?.trim() ?? "";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID?.trim() ?? "";
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY?.trim() ?? "";
const AWS_SESSION_TOKEN = process.env.AWS_SESSION_TOKEN?.trim() ?? "";

if (!AWS_REGION || !S3_BUCKET_NAME || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.warn(
    "S3 client not configured. Missing AWS_REGION, S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, or AWS_SECRET_ACCESS_KEY."
  );
}

const hasValidS3Config =
  Boolean(AWS_REGION) &&
  Boolean(S3_BUCKET_NAME) &&
  Boolean(AWS_ACCESS_KEY_ID) &&
  Boolean(AWS_SECRET_ACCESS_KEY);

const s3Client = hasValidS3Config
  ? new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
        ...(AWS_SESSION_TOKEN ? { sessionToken: AWS_SESSION_TOKEN } : {}),
      },
    })
  : null;

export class S3UploadConfigError extends Error {
  constructor(message = "Image upload is not configured") {
    super(message);
    this.name = "S3UploadConfigError";
  }
}

type PresignedUrlParams = {
  contentType: string;
  userId: string;
};

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function getPresignedUploadUrl({ contentType, userId }: PresignedUrlParams) {
  if (!s3Client || !AWS_REGION || !S3_BUCKET_NAME) {
    throw new S3UploadConfigError(
      "Missing S3 configuration. Set AWS_REGION, S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY."
    );
  }

  const normalizedType = contentType.trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(normalizedType)) {
    throw new S3UploadConfigError("Unsupported file type. Please upload a JPG, PNG, or WEBP image.");
  }

  const fileKey = `listing-images/${userId}/${randomUUID()}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: fileKey,
    ContentType: normalizedType,
    ACL: "public-read", // Make the object publicly readable
  });

  let signedUrl: string;
  try {
    signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 60 * 5, // 5 minutes
    });
  } catch {
    throw new S3UploadConfigError(
      "Invalid AWS credentials for S3 image upload. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."
    );
  }

  const publicUrl = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${fileKey}`;

  return { signedUrl, publicUrl };
}
