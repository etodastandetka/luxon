import { NextResponse } from 'next/server'
import { createErrorResponse, ApiResponse } from './api-helpers'
import { logger } from './logger'

/**
 * Standardized error types
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 400, details)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found', details?: any) {
    super(message, 404, details)
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized', details?: any) {
    super(message, 401, details)
    this.name = 'UnauthorizedError'
  }
}

export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(message, 500, details)
    this.name = 'InternalServerError'
  }
}

/**
 * Handle errors in API routes
 * @param error - Error object
 * @param context - Additional context for logging
 * @returns NextResponse with error
 */
export function handleApiError(
  error: unknown,
  context?: { requestId?: string; endpoint?: string; [key: string]: any }
): NextResponse<ApiResponse> {
  // Log error with context
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined
  
  logger.error('API Error', {
    message: errorMessage,
    stack: errorStack,
    ...context,
  })

  // Handle known error types
  if (error instanceof ApiError) {
    return createErrorResponse(
      error.message,
      error.statusCode,
      { ...error.details, ...context }
    )
  }

  // Handle validation errors
  if (error instanceof Error && error.name === 'ValidationError') {
    return createErrorResponse(error.message, 400, context)
  }

  // Handle network/timeout errors
  if (error instanceof Error && error.name === 'AbortError') {
    return createErrorResponse(
      'Request timeout',
      504,
      { ...context, timeout: true }
    )
  }

  // Handle JSON parse errors
  if (error instanceof SyntaxError && error.message.includes('JSON')) {
    return createErrorResponse(
      'Invalid JSON in request body',
      400,
      context
    )
  }

  // Default: internal server error
  return createErrorResponse(
    errorMessage || 'Internal server error',
    500,
    context
  )
}

/**
 * Wrap async handler with error handling
 */
export function withErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleApiError(error, {
        endpoint: args[0]?.url || 'unknown',
      })
    }
  }
}

/**
 * Validate request body
 */
export function validateBody<T extends Record<string, any>>(
  body: any,
  requiredFields: (keyof T)[]
): body is T {
  const missing = requiredFields.filter(field => !(field in body))
  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missing.join(', ')}`,
      { missingFields: missing }
    )
  }
  return true
}

