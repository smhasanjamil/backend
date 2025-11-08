export interface IUpdateUserRequest {
  firstName?: string;
  lastName?: string;
}

export interface IUserFilterRequest {
  searchTerm?: string;
  role?: string;
}