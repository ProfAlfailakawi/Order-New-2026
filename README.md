# Customer Ordering Application

This application handles customer ordering, order tracking, split payments, admin views, and offline behavior.
It acts as the backend and the core API layer for the ordering experience, primarily utilizing Firebase and external payment providers.

## Key Features
- **Customer Lifecycle:** Complete journey from session setup, order creation, and tracking.
- **Payment Integrity:** Uses server-side price calculation and idempotency to ensure payment data cannot be tampered with or submitted redundantly.
- **Split Payments:** Advanced split payment handling (Qatia) with race condition checks to ensure the total is never overpaid.
- **Offline / PWA:** Supports caching mechanisms for offline viewing and PWA support.
- **Admin Endpoints:** Protected admin routes using token-based authentication.

## Setup & Running Locally

**Prerequisites:** Node.js (v22+)

1. Install dependencies:
   \`npm install\`

2. Set required Environment Variables in \`.env.local\`:
   - \`GEMINI_API_KEY\`: Your Gemini API key for AI features.
   - \`PORT\`: Optional, defaults to 3000.

3. Run the development server:
   \`npm run dev\`

4. Run tests:
   \`npx vitest run\`

## Testing & CI
A rigorous safety net is provided via Vitest. The \`.github/workflows/ci.yml\` enforces that on every push and PR:
1. Typechecks pass (\`npm run lint\`)
2. Tests pass (\`npx vitest run\`)
3. The build is successful (\`npm run build\`)
