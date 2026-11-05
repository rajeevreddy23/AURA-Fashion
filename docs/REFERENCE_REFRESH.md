# Reference image refresh — 5 November 2026

Visual target: the user's two “AURA Fashion Bridal Design Studio” screenshots and “AURA Fashion AI Try-On App Flow” image. The app now follows their emerald desktop workspace and blush/green mobile identity. This is not a pixel-identical or feature-complete reproduction of every capability illustrated in those mockups.

| Reference area | Implemented in this refresh | Remaining difference |
|---|---|---|
| Desktop shell | AURA dress mark, top workspace tabs, collection search, publishing/account controls, emerald tool rail and branded banner | No invented credit balance or notification count |
| Workspace | Numbered panels, avatar summary above components, split canvases, stage tools, inspector/physics card, lower trims/colorways/checks/fit trays and footer actions | Working mannequin retained as explicitly requested on 5 November; a photographic editable avatar remains a future asset-dependent upgrade |
| Avatar and patterns | Existing real measurements, supported component geometry, keyboard/touch arrangement and live synchronized dimensions retained | No pose animation library, arbitrary curve drafting, UV editor or production sewing solver |
| Materials, trims and variants | Actual fabric edits, trim selection, colorway application, saved versions and restores | Decorative tiles are illustrations; they are not a commercial embroidery asset library |
| Fit and simulation | Actual circumference ease and the existing bounded skirt solver | No fabricated pressure/strain maps; production fit and realistic full-body cloth remain unimplemented |
| Mobile landing and shop | Blush hero, locally delivered bridal inspiration, shortcuts, categories, collection search, compact product cards and five primary mobile destinations | Hero is an AI-created illustrative asset, not a product, editable 3D model or customer try-on result |
| Photo/payment/result flow | Select and preview photo before payment; explicit consent; temporary account/product-scoped checkout handoff; removal, expiry and cleanup; existing verified server payment/result/refund flow retained | Hosted Stripe Checkout remains the payment provider. The illustrated Razorpay/UPI/wallet selectors and example prices are not copied as fake controls |
| Community/boutique/plans | Existing real access approvals, designer controls, quotes and prepaid publishing entitlements retained and linked from the new shell | No fabricated sales/revenue totals; recurring subscriptions and real provider/cloud acceptance still await implementation/setup |

## Temporary photo handling

The input photo is held in memory while choosing it. Only after permission is confirmed and checkout begins is a copy written to this tab's session storage. It is scoped to the signed-in UID and selected product and becomes unusable after 30 minutes. The initial page mount waits for an actual current user before restoring or discarding the photo; the authentication callback preserves a valid owner's copy and clears it on sign-out/account mismatch. Returning to the app clears expired, mismatched or malformed entries. Selecting/removing a photo and generation attempts clear the handoff; tab closure also clears browser session storage according to browser behavior. A browser left away from the app may retain the expired bytes until the next visit or tab/session cleanup; this is not a background deletion service. It is not encrypted storage. No input photo is uploaded to the app's database or image bucket by this handoff.

The user-facing consent describes the temporary browser copy. If writing it fails, checkout does not begin. Authenticated paid fulfillment, product approval, consent and provider cost limits remain enforced on the server; client-side photo state cannot grant an entitlement or authorize an unpaid generation.

## Verification

Type checks, the production build and 31 domain/API checks passed. The full 80-case Chromium browser suite passed across 320×800, 390×844, 768×1024, 1024×768 and 1440×1000. After the final desktop layout, zoom and authentication-handoff refinements, 55 affected browser cases were rerun successfully. The desktop reference screenshot additionally uses 1672×941. These are 80 distinct browser cases, not 135 different tests. The 3 handoff unit cases cover same-user restoration, expiry, account/product mismatch, sign-out, rejected formats and unavailable storage; they do not constitute a live hosted-checkout/Firebase-return test.

No live charge, real customer photo, actual provider try-on, production authentication/storage integration, physical-device session, Safari/Firefox run or manufacturing-fit validation was performed.
