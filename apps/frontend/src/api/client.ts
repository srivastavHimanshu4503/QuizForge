import { ApiResponse } from '@quiz-forge/shared';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(options.body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include HTTP-Only session cookies
  });

  const data: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    error: {
      code: 'PARSE_ERROR',
      message: 'Failed to parse server response',
    },
  }));

  if (!response.ok || !data.success) {
    throw new ApiError(
      data.error?.message || `Request failed with status ${response.status}`,
      response.status,
      data.error?.code || 'UNKNOWN_ERROR',
      data.error?.details
    );
  }

  return data.data as T;
}

export const apiClient = {
  get: <T>(url: string, options?: RequestInit) =>
    request<T>(url, { ...options, method: 'GET' }),

  post: <T>(url: string, body?: unknown, options?: RequestInit) =>
    request<T>(url, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : '{}',
    }),

  put: <T>(url: string, body?: unknown, options?: RequestInit) =>
    request<T>(url, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : '{}',
    }),

  patch: <T>(url: string, body?: unknown, options?: RequestInit) =>
    request<T>(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(url: string, options?: RequestInit) =>
    request<T>(url, { ...options, method: 'DELETE' }),

  postFormData: <T>(url: string, formData: FormData, options?: RequestInit) =>
    request<T>(url, {
      ...options,
      method: 'POST',
      body: formData,
    }),
};
