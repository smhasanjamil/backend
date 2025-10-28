import prisma from "../../config/prisma";
import AppError from "../../errors/AppError";
import calculatePagination from "../../utils/paginationHelper";
import { IUpdateUserRequest, IUserFilterRequest } from "./user.interface";

const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return user;
};

const updateProfile = async (userId: string, payload: IUpdateUserRequest) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: payload,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isVerified: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

const getAllUsers = async (options: any, filters: IUserFilterRequest) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  const where: any = {};

  if (filters.searchTerm) {
    where.OR = [
      { email: { contains: filters.searchTerm, mode: "insensitive" } },
      { name: { contains: filters.searchTerm, mode: "insensitive" } },
    ];
  }

  if (filters.role) {
    where.role = filters.role;
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isVerified: true,
      createdAt: true,
    },
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder },
  });

  const total = await prisma.user.count({ where });

  return {
    meta: { page, limit, total },
    data: users,
  };
};

const deleteUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  return { message: "User deleted successfully" };
};

export const UserService = {
  getProfile,
  updateProfile,
  getAllUsers,
  deleteUser,
};
