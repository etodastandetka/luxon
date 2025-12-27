# Environment Variables for Android App

This document describes environment variables that should be configured in the Android app.

## Database Configuration

The app uses hardcoded values in `DatabaseConfig.kt`. For production, these should be moved to:
- Build configuration (build.gradle)
- Or secure storage (Android Keystore)

### Current Hardcoded Values (should be moved to env):

- `DB_HOST` - Database host (currently: `89.23.117.61`)
- `DB_PORT` - Database port (currently: `5432`)
- `DB_NAME` - Database name (currently: `default_db`)
- `DB_USER` - Database user (currently: `gen_user`)
- `DB_PASSWORD` - Database password (currently: `dastan10dz`)
- `API_BASE_URL` - PHP API endpoint (currently: `http://89.23.117.61/api/payments.php`)
- `ADMIN_API_BASE_URL` - Admin API URL (currently: `https://japar.click`)
- `JWT_SECRET` - JWT secret key (currently: `your-secret-key-change-in-production-2025`)

## Recommendation

For Android apps, sensitive values should be:
1. Stored in `local.properties` (not committed to git)
2. Or in `build.gradle` with build variants
3. Or in Android Keystore for production

## Example local.properties

```properties
DB_HOST=89.23.117.61
DB_PORT=5432
DB_NAME=default_db
DB_USER=gen_user
DB_PASSWORD=your_password_here
API_BASE_URL=http://89.23.117.61/api/payments.php
ADMIN_API_BASE_URL=https://japar.click
JWT_SECRET=your-secret-key-here
```

