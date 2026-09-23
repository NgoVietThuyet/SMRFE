// DTO khớp BE (BE.Core/DTOs/HumanResources + HumanResourceService).
// organization-tree/titles/employees trả về anonymous object — ASP.NET serialize camelCase nên FE dùng đúng tên field này.

// GET /api/human-resources/organization-tree — flat, FE dựng cây client-side từ Id/PId
export interface OrganizationFlat {
    id: string;
    pId: string;
    name: string;
    orderNumber: number;
    expanded: boolean;
    isActive: boolean;
    notes?: string | null;
    employeeCount: number;
}

// Node cây dựng ở FE (không hard-code org nào)
export interface OrganizationNode {
    id: string;
    name: string;
    orderNumber: number;
    isActive: boolean;
    notes?: string | null;
    employeeCount: number; // trực tiếp
    subtreeCount: number; // cộng dồn cả cây con
    children: OrganizationNode[];
}

// GET /api/human-resources/titles
export interface DirectoryTitle {
    code: string;
    name: string;
    notes?: string | null;
    orderNumber: number;
    isActive: boolean;
    employeeCount: number;
}

// GET /api/human-resources/employees + employees/{userName}
export interface DirectoryEmployee {
    userName: string;
    fullName: string;
    email: string;
    phone?: string | null;
    address?: string | null;
    orgId: string;
    organizationName?: string | null;
    titleCode: string;
    titleName?: string | null;
    isActive: boolean;
    mustChangePassword?: boolean;
    lastLoginAt?: string | null;
    createDate?: string;
    updateDate?: string;
}

export interface PagedDirectoryEmployees {
    items: DirectoryEmployee[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}

// POST /api/human-resources/directory-employees — BE tự sinh userName/password, chỉ trả userName
export interface CreateDirectoryEmployeeRequest {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    organizationId: string;
    titleCode: string;
}

export interface UpdateDirectoryEmployeeRequest {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    organizationId: string;
    titleCode: string;
}

export interface CreateOrganizationRequest {
    name: string;
    parentId?: string | null;
    orderNumber: number;
    isActive: boolean;
    notes?: string | null;
}

export interface TitleRequest {
    code: string;
    name: string;
    notes?: string | null;
    orderNumber: number;
    isActive: boolean;
}
