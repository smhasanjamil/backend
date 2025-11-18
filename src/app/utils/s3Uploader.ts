import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import config from "../config";
import AppError from "../errors/AppError";
import sharp from "sharp";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

// Initialize S3 Client
const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.access_key_id,
    secretAccessKey: config.aws.secret_access_key,
  },
});

// Allowed image types
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// Max file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface IUploadOptions {
  folder?: string; // e.g., "profiles", "products", "posts"
  resize?: {
    width?: number;
    height?: number;
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  };
  quality?: number; // 1-100
}

interface IUploadedFile {
  key: string; // S3 object key
  url: string; // Full S3 URL
  bucket: string;
  size: number;
  mimetype: string;
}

/**
 * Validate image file
 */
const validateImage = (file: Express.Multer.File): void => {
  if (!file) {
    throw new AppError(400, "No file provided");
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw new AppError(
      400,
      "Invalid file type. Only JPEG, PNG, and WebP are allowed"
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new AppError(400, "File size exceeds 5MB limit");
  }
};

/**
 * Process image with Sharp (resize, compress, optimize)
 */
const processImage = async (
  buffer: Buffer,
  options?: IUploadOptions
): Promise<Buffer> => {
  let image = sharp(buffer);

  // Resize if options provided
  if (options?.resize) {
    image = image.resize({
      width: options.resize.width,
      height: options.resize.height,
      fit: options.resize.fit || "cover",
      withoutEnlargement: true,
    });
  }

  // Convert to WebP for better compression
  image = image.webp({
    quality: options?.quality || 80,
    effort: 6, // 0-6, higher = better compression but slower
  });

  return await image.toBuffer();
};

/**
 * Generate unique S3 key
 */
const generateS3Key = (
  originalName: string,
  folder?: string
): { key: string; filename: string } => {
  const timestamp = Date.now();
  const uuid = uuidv4().split("-")[0]; // Short UUID
  const ext = "webp"; // Always use webp after processing
  const sanitizedName = originalName
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[^a-zA-Z0-9]/g, "-") // Replace special chars
    .toLowerCase()
    .substring(0, 30); // Limit length

  const filename = `${sanitizedName}-${timestamp}-${uuid}.${ext}`;
  const key = folder ? `${folder}/${filename}` : filename;

  return { key, filename };
};

/**
 * Upload single image to S3
 */
export const uploadImageToS3 = async (
  file: Express.Multer.File,
  options?: IUploadOptions
): Promise<IUploadedFile> => {
  try {
    // Validate file
    validateImage(file);

    // Process image
    const processedBuffer = await processImage(file.buffer, options);

    // Generate S3 key
    const { key } = generateS3Key(file.originalname, options?.folder);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: config.aws.s3_bucket_name,
      Key: key,
      Body: processedBuffer,
      ContentType: "image/webp",
      CacheControl: "max-age=31536000", // 1 year cache
    });

    await s3Client.send(command);

    // Generate public URL
    const url = `https://${config.aws.s3_bucket_name}.s3.${config.aws.region}.amazonaws.com/${key}`;

    return {
      key,
      url,
      bucket: config.aws.s3_bucket_name,
      size: processedBuffer.length,
      mimetype: "image/webp",
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, `Image upload failed: ${error.message}`);
  }
};

/**
 * Upload multiple images to S3
 */
export const uploadMultipleImagesToS3 = async (
  files: Express.Multer.File[],
  options?: IUploadOptions
): Promise<IUploadedFile[]> => {
  if (!files || files.length === 0) {
    throw new AppError(400, "No files provided");
  }

  // Upload all files in parallel
  const uploadPromises = files.map((file) => uploadImageToS3(file, options));

  try {
    return await Promise.all(uploadPromises);
  } catch (error: any) {
    throw new AppError(500, `Multiple image upload failed: ${error.message}`);
  }
};

/**
 * Delete image from S3
 */
export const deleteImageFromS3 = async (key: string): Promise<void> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: config.aws.s3_bucket_name,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error: any) {
    console.error("S3 delete error:", error);
    // Don't throw error for delete failures (image might already be deleted)
  }
};

/**
 * Delete multiple images from S3
 */
export const deleteMultipleImagesFromS3 = async (
  keys: string[]
): Promise<void> => {
  const deletePromises = keys.map((key) => deleteImageFromS3(key));
  await Promise.allSettled(deletePromises); // Continue even if some fail
};

/**
 * Extract S3 key from full URL
 */
export const extractS3KeyFromUrl = (url: string): string | null => {
  if (!url) return null;

  try {
    // Handle both formats:
    // 1. https://bucket.s3.region.amazonaws.com/key
    // 2. https://s3.region.amazonaws.com/bucket/key
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.substring(1); // Remove leading /
    return pathname;
  } catch {
    return null;
  }
};

/**
 * Generate presigned URL for temporary access (optional, for private files)
 */
export const getPresignedUrl = async (
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: config.aws.s3_bucket_name,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error: any) {
    throw new AppError(
      500,
      `Failed to generate presigned URL: ${error.message}`
    );
  }
};

/**
 * Replace existing image (delete old, upload new)
 */
export const replaceImage = async (
  oldUrl: string | null | undefined,
  newFile: Express.Multer.File,
  options?: IUploadOptions
): Promise<IUploadedFile> => {
  // Upload new image first
  const newImage = await uploadImageToS3(newFile, options);

  // Delete old image if exists (don't await, fire and forget)
  if (oldUrl) {
    const oldKey = extractS3KeyFromUrl(oldUrl);
    if (oldKey) {
      deleteImageFromS3(oldKey).catch((err) =>
        console.error("Failed to delete old image:", err)
      );
    }
  }

  return newImage;
};
