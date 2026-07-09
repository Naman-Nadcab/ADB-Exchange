# Environment — UI Baseline Snapshot

**Recorded:** 2026-06-25  
**Repository:** `/opt/m-live`  
**Frontend app:** `apps/frontend`

## Runtime

| Item | Version |
|------|---------|
| Node.js (host) | v20.20.2 |
| OS | Linux 6.8.0-124-generic |

## Core framework (apps/frontend/package.json)

| Package | Version |
|---------|---------|
| next | 14.0.4 |
| react | ^18.2.0 |
| react-dom | ^18.2.0 |
| typescript | ^5.3.3 |
| tailwindcss | ^3.4.0 |
| postcss | ^8.4.32 |
| autoprefixer | ^10.4.16 |
| eslint | ^8.56.0 |
| eslint-config-next | 14.0.4 |

## UI / styling

| Package | Version |
|---------|---------|
| tailwindcss-animate | ^1.0.7 |
| tailwind-merge | ^2.2.0 |
| class-variance-authority | ^0.7.0 |
| clsx | ^2.1.0 |
| lucide-react | ^0.303.0 |
| antd | ^5.12.0 |

## Radix UI

| Package | Version |
|---------|---------|
| @radix-ui/react-dialog | ^1.0.5 |
| @radix-ui/react-dropdown-menu | ^2.0.6 |
| @radix-ui/react-tabs | ^1.0.4 |
| @radix-ui/react-tooltip | ^1.0.7 |
| @radix-ui/react-toast | ^1.1.5 |
| (others) | see package.json |

## Data / charts / forms

| Package | Version |
|---------|---------|
| @tanstack/react-query | ^5.17.0 |
| @tanstack/react-table | ^8.21.3 |
| lightweight-charts | ^4.1.1 |
| recharts | ^2.10.3 |
| react-hook-form | ^7.49.2 |
| zod | ^3.22.4 |
| zustand | ^4.4.7 |
| axios | ^1.6.2 |
| decimal.js | ^10.4.3 |
| qrcode.react | ^4.2.0 |
| @simplewebauthn/browser | ^13.2.2 |
| next-auth | ^5.0.0-beta.4 |

## Build / deploy

- **Output:** `standalone` (see `apps/frontend/next.config.js`)
- **Production compose:** `docker-compose.production.yml`
- **Frontend container:** `exchange-frontend` (port 3000 internal)

## Lockfile

No `package-lock.json` in `apps/frontend/` at snapshot time; versions resolved from `package.json` ranges.
