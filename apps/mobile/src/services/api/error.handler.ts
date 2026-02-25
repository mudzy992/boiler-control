import { AxiosError } from 'axios';

/**
 * Error handling utility for consistent error messages across the mobile app
 * Converts backend errors into user-friendly messages
 */

export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
}

export class ApiError extends Error {
  public statusCode: number;
  public isNetworkError: boolean;
  public userMessage: string;

  constructor(
    statusCode: number,
    message: string,
    isNetworkError: boolean = false,
    userMessage?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isNetworkError = isNetworkError;
    this.userMessage = userMessage || this.getDefaultUserMessage(statusCode);
  }

  private getDefaultUserMessage(statusCode: number): string {
    switch (statusCode) {
      case 400:
        return 'Invalid request. Please check your input and try again.';
      case 401:
        return 'Your session has expired. Please log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'This action conflicts with existing data. Please try again.';
      case 422:
        return 'Please check your input and try again.';
      case 500:
        return 'Server error. Please try again later.';
      case 503:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        if (this.isNetworkError) {
          return 'Network error. Please check your connection and try again.';
        }
        return 'An error occurred. Please try again.';
    }
  }
}

/**
 * Parse Axios error into user-friendly ApiError
 */
export function parseApiError(error: unknown): ApiError {
  // Network error (no response)
  if (error instanceof AxiosError && !error.response) {
    return new ApiError(
      0,
      error.message || 'Network request failed',
      true,
      'Network error. Please check your connection and try again.'
    );
  }

  // HTTP error response
  if (error instanceof AxiosError && error.response) {
    const status = error.response.status;
    const data = error.response.data as ApiErrorResponse | undefined;
    const message = data?.message || error.message || 'Unknown error';
    const userMessage = data?.message || undefined;

    return new ApiError(status, message, false, userMessage);
  }

  // Generic error
  if (error instanceof Error) {
    return new ApiError(500, error.message, false);
  }

  return new ApiError(500, 'An unknown error occurred', false);
}

/**
 * Hook for showing error toasts
 * Usage: const { showError } = useErrorHandler();
 *        showError(error);
 */
export function useErrorHandler() {
  // Simple toast implementation using alert-like UI
  const showError = (error: unknown, customMessage?: string) => {
    const apiError = error instanceof ApiError ? error : parseApiError(error);
    const finalMessage = customMessage || apiError.userMessage;

    // For now, we'll use a simple console.error and could integrate with a toast library
    console.error('[API Error]', {
      statusCode: apiError.statusCode,
      message: apiError.message,
      userMessage: finalMessage,
      isNetworkError: apiError.isNetworkError,
    });

    // This could be replaced with a toast.show() call if a toast library is integrated
    // toast.show({
    //   render: ({ id }) => (
    //     <Box bg="red.500" px={3} py={2} rounded="md" mb={2}>
    //       <HStack space={2} alignItems="center">
    //         <Icon as={Ionicons} name="alert-circle" size={5} color="white" />
    //         <Text color="white" fontSize="sm" flex={1}>
    //           {message}
    //         </Text>
    //       </HStack>
    //     </Box>
    //   ),
    //   duration: 4000,
    //   placement: 'top',
    // });
  };

  return { showError };
}

/**
 * Standalone version for use outside hooks
 */
export function showErrorToast(error: unknown, customMessage?: string) {
  const apiError = error instanceof ApiError ? error : parseApiError(error);
  const message = customMessage || apiError.userMessage;

  console.error('[API Error]', {
    statusCode: apiError.statusCode,
    message: apiError.message,
    userMessage: apiError.userMessage,
    isNetworkError: apiError.isNetworkError,
  });

  return message;
}
