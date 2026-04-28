# Boiler Control - "blocked:other" Issue Troubleshooting

## Problem
API calls from frontend to backend are being blocked with "blocked:other" error in browser console.

## Root Cause
This is typically caused by one of:
1. **Content-Security-Policy (CSP)** headers blocking the request
2. **CORS** headers missing or incorrect
3. **Mixed HTTP/HTTPS** content
4. Incomplete or malformed CSP header

## Solution

### 1. Fix CSP Header (Traefik middleware)
If you're using Traefik as the only entrypoint, set CSP via a `headers` middleware on the frontend router.

Key changes:
Use `docker-compose.yml` labels for `boiler-security-headers` middleware.

### 2. CORS
When frontend and backend are served from the same host via Traefik (`/backend/...`), CORS is typically not needed at the proxy layer. If you still need it, configure it in the backend (NestJS `enableCors()`), not via Apache.

### 3. Proxy / routing
Traefik handles host + path routing via labels (see `docker-compose.yml`).

### 4. Update Frontend API Client (Optional but Recommended)
If API calls still fail, update the frontend API client to use relative URLs:

In `/frontend/src/services/api.ts`:
```typescript
// OLD
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3020/api';

// NEW - Use relative URL when behind proxy
const API_BASE_URL = import.meta.env.VITE_API_URL || '/backend/api';
```

This way, both frontend and backend are accessed from the same domain.

---

## Implementation Steps

1. **Apply Traefik security headers middleware**:
   - Ensure `boiler-security-headers` middleware labels exist (in `docker-compose.yml`).
   - Ensure routers reference it (frontend router, and optionally backend router).

5. **Test Frontend API Calls**:
   - Open browser dev tools (F12)
   - Go to Network tab
   - Make an API call from the frontend
   - Check that request succeeds (200 status)
   - Look for any CSP or CORS errors in Console tab

---

## Debugging

### Check Apache Error Logs
```bash
sudo tail -f /var/log/apache2/boiler-control_error.log
```

If you're not using Apache at all, skip this step and check Traefik logs instead.
### Check Browser Console
Open browser DevTools (F12) → Console tab:
- Look for "Content-Security-Policy" errors
- Look for "CORS" errors
- Look for "blocked:other" messages

### Test API Connectivity
```bash
# From server, test backend is running
curl http://localhost:3020/api/health

# From server, test frontend is running
curl http://localhost:3021/

# Test through proxy
curl -H "Host: boiler.ba101.top" https://localhost:443/backend/api/health
```

---

## Common Issues

### Issue: "blocked:other" in Chrome DevTools
**Cause**: CSP policy blocking the request
**Fix**: Ensure `connect-src` includes the correct domain

### Issue: CORS error
**Cause**: Missing Access-Control headers
**Fix**: Add CORS headers to Apache config

### Issue: Mixed content (HTTP/HTTPS)
**Cause**: Frontend trying to load HTTP resources over HTTPS
**Fix**: Ensure all requests use HTTPS, use relative URLs

### Issue: 401 Unauthorized
**Cause**: Token not being sent
**Fix**: Ensure credentials header is set in API client

---

## Security Notes

1. **CSP Header**: Restricts what scripts/styles can be loaded
   - `default-src 'self'` - Only allow from same origin by default
   - `connect-src` - Allows API calls to specified domains
   - `script-src 'unsafe-inline'` - Required for Ant Design/React (can be removed with proper webpack configuration)

2. **CORS Headers**: Allow cross-origin requests
   - Origin: Limited to your domain only
   - Methods: Only allow needed HTTP methods
   - Credentials: Set to true if using cookies/auth

3. **X-Frame-Options**: Prevents clickjacking
4. **X-Content-Type-Options**: Prevents MIME sniffing

---

## Files to Use

- **Traefik labels**: `docker-compose.yml`

---

**Status**: Follow the steps above to fix the "blocked:other" issue. If problems persist, check logs and share any error messages.
