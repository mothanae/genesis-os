export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorDetail;
  meta?: PaginationMeta;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}
