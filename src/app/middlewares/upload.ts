import multer from "multer";
import AppError from "../errors/AppError";

// Memory storage (files stored in buffer, not disk)
const storage = multer.memoryStorage();

// File filter
const imageFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        400,
        "Invalid file type. Only JPEG, PNG, and WebP images are allowed"
      )
    );
  }
};

// Base multer config
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10, // Max 10 files at once
  },
});

// Export different upload configurations
export const uploadSingle = (fieldName: string = "image") =>
  upload.single(fieldName);

export const uploadMultiple = (
  fieldName: string = "images",
  maxCount: number = 10
) => upload.array(fieldName, maxCount);

export const uploadFields = (fields: { name: string; maxCount: number }[]) =>
  upload.fields(fields);

export default upload;
