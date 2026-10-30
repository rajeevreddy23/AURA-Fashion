# AURA Fashion

The project is maintained in `D:\AURA Fashion` and targets https://github.com/rajeevreddy23/AURA-Fashion. The initial code was imported from the existing `rajeevreddy23/AuraFashion` application because the new repository was empty.

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Studio and the sample catalog work without paid-service credentials. Prices and paid actions remain unavailable until the backend is configured. The browser Firebase configuration is in `firebase-applet-config.json`; replace it with the configuration for the intended Firebase project. Firebase browser configuration is public identification, not a server credential.

## What is implemented

- Responsive Studio with progressive tools: garment templates, drag-and-drop details, tap-to-add, pointer drawing, selection and keyboard movement, shape tools, erasing, image import, layer selection, duplication and ordering.
- Fifty-step undo/redo, autosave on this device, JSON open/save, PNG and SVG export. A guest draft is carried into a newly used account on this device if that account has no draft.
- Synchronized, rotatable extruded 3D concepts for shirt, dress and skirt templates. Saree panels clearly state that 3D is unsupported. Artwork maps onto the garment preview; this is not a cloth or body-fit simulation.
- Shop filtering/search, most-liked/newest/price sorting, server-maintained unique account likes, published community designs, and visible try-on actions.
- Stripe Checkout for one product-specific try-on, one sketch render, one publication, or a prepaid 30-day publishing pass with 30 uploads. Each try-on is paid separately. The publishing pass has no automatic renewal.
- Payment fulfillment from signed webhooks or server-side Checkout recheck, owner-only order history, atomic job reservations, private results, manual early deletion, failure refunds, unused-job refunds, and stalled-job recovery after 20 minutes.
- Publishing consumes a verified upload credit or a nonexpired pass upload atomically. New designs require review before try-on can be enabled.
- Approved boutique directory, customer quote requests with explicit sharing consent, private quote history, and replies/prices from the assigned boutique account.
- Hardened Firestore and Storage rules. Paid state, counters, quotes, and orders are server-only. Admin access uses a trusted Firebase custom `admin` claim; an email address or editable profile role cannot grant it.

## Configure paid services

Copy `.env.example` to `.env` and configure these on the server, never with a `VITE_` prefix:

1. Set `FIREBASE_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, and `FIREBASE_STORAGE_BUCKET` to the intended project/database/bucket. Supply Application Default Credentials (locally, `GOOGLE_APPLICATION_CREDENTIALS` points to a service-account file outside the repository). Grant only the required database, storage, and token-verification permissions.
2. Deploy `firestore.rules` and `storage.rules` to that project. Review existing user data and remove any previously self-granted subscriptions or roles; the new billing flow ignores them. Set trusted custom admin claims through the Admin SDK, then refresh the operator's login token.
3. Configure a Stripe account for INR payments. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the exact public HTTPS `APP_URL`, without a trailing slash. Use the same Stripe account and test/live mode for all three. Register `/api/payments/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `charge.refunded`. Keep Stripe retry delivery enabled.
4. Set `GEMINI_API_KEY` and an image-capable `GEMINI_IMAGE_MODEL` available to that account. There is deliberately no assumed model or invented API price. Check current model support and pricing at https://ai.google.dev/gemini-api/docs/image-generation.
5. Enter integer-paise prices and conservative upper cost estimates. `JOB_OVERHEAD_PAISE` should include fixed transaction fees and infrastructure overhead. Percentage payment fees and a tax reserve are configured as basis points. The try-on/render price must cover the configured provider cost, overhead, percentage reserves, and minimum margin. Failed attempts also count toward reserved daily spend. Configure `DAILY_AI_BUDGET_PAISE` and per-user daily limits. These are safeguards based on your estimates, not a guarantee of profit if estimates, taxes, exchange rates or provider charges change. Review costs before enabling sales and whenever pricing/model settings change.
6. Review each garment's image and supported category before enabling `tryOnEnabled: true` in an administrator-managed product document. For sample products, explicitly list approved IDs in `APPROVED_TRYON_PRODUCT_IDS`. Default image hosts are Unsplash and Shopify's image CDN. Additional hosts must be trusted HTTPS CDNs, with no arbitrary URLs or redirects. Use owned/licensed product images. Accessories and shoes are not supported by this try-on flow.
7. Create approved boutique records in `boutiques/{id}` with `name`, `city`, `active: true`, and `ownerId` equal to that boutique account's Firebase UID. The app does not invent available boutiques or send quote requests outside the application.
8. Set a bucket lifecycle rule to delete objects under `results/` after seven days. API access expires after seven days regardless, but physical cleanup requires this lifecycle configuration. Input photos are passed to the AI provider without being saved by the app; review that provider's retention terms. Set a retention policy for financial records and an operational support/refund procedure.

Verify `/api/config` reports the intended readiness and prices. Test Stripe test-mode checkout, webhook delivery/replay, real provider success/failure, refunds, authentication, and production storage permissions before accepting real payments. None of those live integrations was exercised using real customer credentials during this update.

## Tests

```sh
npm run lint
npm test
npm run test:e2e
npm run test:rules
npm run build
npm start
```

- API tests use real local HTTP, real Stripe signature verification, and simulated payment/provider/storage services. They test billing invariants and failure/concurrency behavior without charging money.
- Browser tests use Chromium at 320×800, 390×844, 768×1024, 1024×768 and 1440×1000. Touch input is emulated for the first four sizes. Automated checks do not replace testing on physical devices, Safari, Firefox or assistive technologies.
- Rules tests require Java 21+ and use the demo-project Firestore emulator, never a production project. A transaction integration case also exercises the actual Admin SDK/Firestore transaction adapter with simulated image storage.
- On Windows systems where the emulator reports an invalid Unix-domain loopback connection, set `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=<a-nonexistent-directory>` for the test process so Java falls back to TCP. This is a local runtime workaround, not a change to service security.
- Browser traces/reports are in ignored `test-results/` and `playwright-report/` directories.

## Deployment and limits

`npm run build` builds the frontend and Express entry point. `npm start` serves both. `PORT` is honored. The Vercel entry point reuses the same API implementation with raw webhook parsing. **Hosting has not been deployed or verified on Vercel or any cloud host.** Image generation can exceed serverless duration or response limits; choose a host with adequate request timeouts or add a durable background queue before high-volume deployment.

This is an implementation with local verification, not a completed international production certification. Remaining work includes live integration acceptance, realistic cloth simulation and fitting, arbitrary-sketch-to-3D reconstruction, measurements/pattern grading, recurring subscription renewals, production moderation and intellectual-property review, localized tax/invoices and currencies, fulfillment/physical garment checkout, large-catalog pagination and scalable ranking, distributed rate limiting, durable queued AI jobs, automated operational reconciliation/alerting, and full cross-browser/manual accessibility validation. The legacy physical-cart checkout is disabled because it previously created orders without charging the customer. Existing cart storage and browsing remain available.

Public catalog and per-account lists currently fetch at most 100 stored records. Likes require signed-in accounts and are transactionally unique per account; fraud resistance against coordinated accounts is not implemented.

The classic raster sketcher remains accessible from Studio. Its AI action routes through paid rendering; rendering a person wearing an arbitrary sketch is replaced by the approved product try-on flow. Sketch images may be exported and uploaded again if returning on a different device. Draft autosave is local, not cloud synchronization.

Provider success does not guarantee a faithful garment representation or accurate fit. Orders that are interrupted after reserving a job cannot be regenerated using the same payment; recover them as a refund instead. Payment disputes and publication refunds after use require an operator policy and review of already published designs.

Integration references: Stripe fulfillment https://docs.stripe.com/checkout/fulfillment and Firebase token verification https://firebase.google.com/docs/auth/admin/verify-id-tokens.
