# Customer Ordering Application

This application handles customer ordering, order tracking, split payments, admin views, and offline behavior.
It acts as the backend and the core API layer for the ordering experience, primarily utilizing Firebase and external payment providers.

## Key Features
- **Customer Lifecycle:** Complete journey from session setup, order creation, and tracking.
- **Server-Authoritative Pricing:** Price calculation and component resolution are performed entirely on the server using trusted catalog and configuration data.
- **Webhook Verification:** Checks the structural authenticity of incoming webhook requests using \`UPAYMENTS_TOKEN\` to provide boundary protection. Note: Real production implementations should extend this to verify cryptographic signatures of the specific provider integration.
- **Best-Effort Idempotency:** Implements an in-memory, local-instance idempotency cache to mitigate duplicate form submissions during minor network retries. Note: For clustered/distributed production setups, this should be migrated to a transactional datastore.
- **State-Transition Protections:** Payment callbacks and webhook updates correctly drop processing for orders in terminal states (cancelled, delivered, rejected).
- **Split Payments:** Advanced split payment handling (Qatia) with race condition checks to ensure the total is never overpaid.
- **Offline / PWA:** Supports caching mechanisms for offline viewing and PWA support.
- **Admin Endpoints:** Protected admin routes utilizing explicit \`admin.auth().verifyIdToken()\` checks and validating admin privileges.

## Setup & Running Locally

**Prerequisites:** Node.js (v22+)

1. Install dependencies:
   \`npm install\`

2. Set required Environment Variables in \`.env.local\`:
   - \`GEMINI_API_KEY\`: Your Gemini API key for AI features.
   - \`UPAYMENTS_TOKEN\`: Token representing the webhook authentication boundary.
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
