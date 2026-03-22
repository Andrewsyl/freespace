import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const AWS_REGION = process.env.AWS_REGION?.trim() ?? "";
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME?.trim() ?? "";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID?.trim() ?? "";
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY?.trim() ?? "";
const AWS_SESSION_TOKEN = process.env.AWS_SESSION_TOKEN?.trim() ?? "";

if (!AWS_REGION || !S3_BUCKET_NAME) {
  console.warn("S3 client not configured. Missing AWS_REGION or S3_BUCKET_NAME.");
}

const hasValidS3Config = Boolean(AWS_REGION) && Boolean(S3_BUCKET_NAME);

const s3Client = hasValidS3Config
  ? new S3Client({
      region: AWS_REGION,
      ...(AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: AWS_ACCESS_KEY_ID,
              secretAccessKey: AWS_SECRET_ACCESS_KEY,
              ...(AWS_SESSION_TOKEN ? { sessionToken: AWS_SESSION_TOKEN } : {}),
            },
          }
        : {}),
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
  fileSizeBytes?: number;
};

export const MAX_LISTING_IMAGE_BYTES = 10 * 1024 * 1024;

const CONTENT_TYPE_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
};

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const ALLOWED_CONTENT_TYPES = new Set(Object.keys(CONTENT_TYPE_EXTENSIONS));

export async function getPresignedUploadUrl({ contentType, userId }: PresignedUrlParams) {
  if (!s3Client || !AWS_REGION || !S3_BUCKET_NAME) {
    throw new S3UploadConfigError(
      "Missing S3 configuration. Set AWS_REGION and S3_BUCKET_NAME (and credentials if running locally)."
    );
  }

  const normalizedType = contentType.trim().toLowerCase();
  const canonicalType = CONTENT_TYPE_ALIASES[normalizedType] ?? normalizedType;
  if (!ALLOWED_CONTENT_TYPES.has(canonicalType)) {
    throw new S3UploadConfigError("Unsupported file type. Please upload a JPG, PNG, or WEBP image.");
  }

  const extension = CONTENT_TYPE_EXTENSIONS[canonicalType] ?? "jpg";
  const fileKey = `listing-images/${userId}/${randomUUID()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: fileKey,
    ContentType: canonicalType,
  });

  let signedUrl: string;
  try {
    signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 60 * 5, // 5 minutes
    });
  } catch {
    throw new S3UploadConfigError(
      "Invalid AWS credentials for S3 image upload. Check your AWS credentials or instance role."
    );
  }

  const publicUrl = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${fileKey}`;

  return { signedUrl, publicUrl };
}

export async function getPresignedPostUpload({
  contentType,
  userId,
  fileSizeBytes,
}: PresignedUrlParams) {
  if (!s3Client || !AWS_REGION || !S3_BUCKET_NAME) {
    throw new S3UploadConfigError(
      "Missing S3 configuration. Set AWS_REGION and S3_BUCKET_NAME (and credentials if running locally)."
    );
  }

  const normalizedType = contentType.trim().toLowerCase();
  const canonicalType = CONTENT_TYPE_ALIASES[normalizedType] ?? normalizedType;
  if (!ALLOWED_CONTENT_TYPES.has(canonicalType)) {
    throw new S3UploadConfigError("Unsupported file type. Please upload a JPG, PNG, or WEBP image.");
  }
  if (fileSizeBytes && fileSizeBytes > MAX_LISTING_IMAGE_BYTES) {
    throw new S3UploadConfigError("Image must be 10MB or smaller.");
  }

  const extension = CONTENT_TYPE_EXTENSIONS[canonicalType] ?? "jpg";
  const fileKey = `listing-images/${userId}/${randomUUID()}.${extension}`;

  try {
    const post = await createPresignedPost(s3Client, {
      Bucket: S3_BUCKET_NAME,
      Key: fileKey,
      Fields: {
        "Content-Type": canonicalType,
      },
      Conditions: [
        ["eq", "$Content-Type", canonicalType],
        ["content-length-range", 1, MAX_LISTING_IMAGE_BYTES],
      ],
      Expires: 300,
    });

    const publicUrl = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${fileKey}`;
    return {
      method: "POST" as const,
      uploadUrl: post.url,
      uploadFields: post.fields,
      publicUrl,
    };
  } catch {
    throw new S3UploadConfigError(
      "Invalid AWS credentials for S3 image upload. Check your AWS credentials or instance role."
    );
  }
}
