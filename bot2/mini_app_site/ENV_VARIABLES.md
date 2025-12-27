# Environment Variables

This document describes all environment variables used in the mini_app_site project.

## Required Variables

### API Configuration

- `ADMIN_API_URL` - Base URL for admin API (server-side)
  - Development: `http://localhost:3001`
  - Production: `http://127.0.0.1:3001` (internal server communication)

- `NEXT_PUBLIC_ADMIN_API_URL` - Public API URL (client-side)
  - Development: `http://localhost:3001`
  - Production: `https://japar.click`

## Optional Variables

- `NEXT_PUBLIC_APP_VERSION` - Application version (auto-generated if not set)
- `NODE_ENV` - Node environment (`development` or `production`)

## Example .env file

```env
# API Configuration
ADMIN_API_URL=http://localhost:3001
NEXT_PUBLIC_ADMIN_API_URL=http://localhost:3001

# Node Environment
NODE_ENV=development
```

## Production Setup

For production, set:

```env
ADMIN_API_URL=http://127.0.0.1:3001
NEXT_PUBLIC_ADMIN_API_URL=https://japar.click
NODE_ENV=production
```

