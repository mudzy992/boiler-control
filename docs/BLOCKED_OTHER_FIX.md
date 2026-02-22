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

### 1. Fix Apache CSP Header
Your current CSP header is incomplete. Use the fixed configuration in `APACHE_VHOST_CONFIG.conf`:

Key changes:
```apache
# OLD (incomplete, causes blocking)
Header always set Content-Security-Policy "default-src 'self';connect-src 'self' http://localhost:3020 ...>"

# NEW (complete and correct)
Header always set Content-Security-Policy "default-src 'self'; \
    connect-src 'self' https://boiler-control.hopto.org wss://boiler-control.hopto.org; \
    img-src 'self' data: blob: https:; \
    style-src 'self' 'unsafe-inline'; \
    script-src 'self' 'unsafe-inline'; \
    font-src 'self' data:; \
    object-src 'none'; \
    base-uri 'self'; \
    form-action 'self'"
```

### 2. Add CORS Headers
Your Apache config is missing CORS headers. Add these:
```apache
Header always set "Access-Control-Allow-Origin" "https://boiler-control.hopto.org"
Header always set "Access-Control-Allow-Methods" "GET, POST, PUT, DELETE, OPTIONS, PATCH"
Header always set "Access-Control-Allow-Headers" "Content-Type, Authorization, X-Requested-With"
Header always set "Access-Control-Allow-Credentials" "true"
```

### 3. Enable ProxyPreserveHost
Your proxy configuration should preserve the Host header:
```apache
ProxyPass /backend/ http://localhost:3020/
ProxyPassReverse /backend/ http://localhost:3020/
ProxyPreserveHost On          # Add this line

ProxyPass / http://localhost:3021/
ProxyPassReverse / http://localhost:3021/
ProxyPreserveHost On          # Add this line
```

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

1. **Update Apache Configuration**:
   ```bash
   # Edit your Apache vhost config
   sudo nano /etc/apache2/sites-available/boiler-control-ssl.conf

   # Replace with content from APACHE_VHOST_CONFIG.conf
   ```

2. **Enable Required Apache Modules**:
   ```bash
   sudo a2enmod headers
   sudo a2enmod rewrite
   sudo a2enmod proxy
   sudo a2enmod proxy_http
   ```

3. **Test Configuration**:
   ```bash
   sudo apache2ctl configtest
   # Should output: Syntax OK
   ```

4. **Restart Apache**:
   ```bash
   sudo systemctl restart apache2
   ```

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
curl -H "Host: boiler-control.hopto.org" https://localhost:443/backend/api/health
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

- **Apache Config**: [APACHE_VHOST_CONFIG.conf](./APACHE_VHOST_CONFIG.conf)
- **Ready to copy and use in your Apache config**

---

**Status**: Follow the steps above to fix the "blocked:other" issue. If problems persist, check logs and share any error messages.
