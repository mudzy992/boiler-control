/**
 * Server returns `/api/app-releases/:id/apk`, while `VITE_API_URL` in
 * production already ends with `/api`. Join them without producing `/api/api`.
 */
export function absoluteDownloadUrl(path: string, apiBase: string): string {
  const base = apiBase.trim().replace(/\/+$/, '');
  if (!base) return path;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const pathWithoutDuplicateApi =
    /\/api$/i.test(base) && /^\/api(?:\/|$)/i.test(normalizedPath)
      ? normalizedPath.replace(/^\/api/i, '') || '/'
      : normalizedPath;

  return `${base}${pathWithoutDuplicateApi}`;
}
