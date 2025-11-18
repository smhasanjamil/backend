import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { UserService } from "./user.service";
import sendResponse from "../../utils/sendResponse";


const getProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getProfile(req.user!.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile retrieved successfully",
    data: result,
  });
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.updateProfile(
    req.user!.userId,
    req.body,
    req.file // Multer file
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    return sendResponse(res, {
      statusCode: 400,
      success: false,
      message: "No image file provided",
    });
  }

  const result = await UserService.uploadProfileImage(
    req.user!.userId,
    req.file
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile image uploaded successfully",
    data: result,
  });
});

const deleteProfileImage = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.deleteProfileImage(req.user!.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
  });
});

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const filters = {
    searchTerm: req.query.searchTerm as string,
    role: req.query.role as string,
  };
  const options = {
    page: req.query.page,
    limit: req.query.limit,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder,
  };
  const result = await UserService.getAllUsers(options, filters);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Users retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.deleteUser(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
  });
});

export const UserController = {
  getProfile,
  updateProfile,
  uploadProfileImage,
  deleteProfileImage,
  getAllUsers,
  deleteUser,
};