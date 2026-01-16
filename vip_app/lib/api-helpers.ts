import { NextResponse } from 'next/server'

/**
 * Standardized API Response format
 * Compatible with admin_nextjs/lib/api-helpers.ts
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Create a standardized API response
 * @param data - Response data (optional)
 * @param error - Error message (optional)
 * @param message - Success message (optional)
 * @returns Standardized API response object
 */
export function createApiResponse<T>(
  data?: T,
  error?: string,
  message?: string
): ApiResponse<T> {
  if (error) {
    return { success: false, error }
  }
  return { success: true, data, message }
}

/**
 * Create a success response with NextResponse
 * @param data - Response data
 * @param message - Success message (optional)
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with standardized format
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(createApiResponse(data, undefined, message), { status })
}

/**
 * Create an error response with NextResponse
 * @param error - Error message
 * @param status - HTTP status code (default: 500)
 * @param details - Additional error details (optional)
 * @returns NextResponse with standardized format
 */
export function createErrorResponse(
  error: string,
  status: number = 500,
  details?: any
): NextResponse<ApiResponse> {
  const response: ApiResponse = { success: false, error }
  if (details) {
    (response as any).details = details
  }
  return NextResponse.json(response, { status })
}

