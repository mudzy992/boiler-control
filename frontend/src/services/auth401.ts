/**
 * Failed login returns HTTP 401. Forcing a full navigation to /login clears
 * the form error message. Other 401s still clear the session and redirect.
 */
export const shouldForceLoginRedirectOn401 = (url: string): boolean => {
  return !url.includes('/auth/login');
};
