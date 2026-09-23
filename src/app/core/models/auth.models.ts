// DTO khớp BE (BE.Core/DTOs/Auth + ResponseDto).
// ASP.NET serialize camelCase nên FE dùng đúng tên field này.

// Envelope chuẩn của BE: ResponseDto { Status, Message, Data }
export interface ApiResponse<T> {
    status: boolean;
    message: string;
    data: T | null;
}

// POST /api/Auth/Login — BE chấp nhận UserName hoặc Email
export interface LoginRequest {
    userName: string;
    password: string;
}

// POST /api/Auth/Refresh
export interface RefreshRequest {
    refreshToken: string;
}

// POST /api/Auth/Logout
export interface LogoutRequest {
    logoutAllDevices: boolean;
}

// POST /api/Auth/ForgotPassword
export interface ForgotPasswordRequest {
    email: string;
}

// AuthResultDto trong Data khi login/refresh thành công
export interface AuthResult {
    success: boolean;
    message?: string | null;
    token?: string | null;
    userName?: string | null;
    fullName?: string | null;
    email?: string | null;
    mustChangePassword: boolean;
    refreshToken?: string | null;
}

export interface AuthUser {
    userName: string;
    fullName: string;
    email: string;
}
