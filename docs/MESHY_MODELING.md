# Meshy modeling and dress library — 8 November 2026

## What is implemented

- `/looks`: 18 editable sample designs, six each for lehengas, gowns and blouses. Each has coordinated fabric, sleeve/skirt dimensions, hem borders and embroidery bands. These are parametric starter designs, not scanned garments or proof of manufacturing fit.
- Home shows a three-look sampler. Shop and Community link to the dress library. Studio provides library and AI 3D Modeling navigation. Samples are not fabricated customer listings or paid products.
- Opening a look in Studio saves the previous local project and creates a new editable project. The existing dimensions, undo, material controls, autosave and exports remain available.
- 2D pattern fills and 3D garment surfaces use the same fabric artwork generator. The 2D Fabric checkbox restores a plain drafting view. Procedural placement remains approximate; it is not an embroidery machine file.
- `/modeling`: 18 local sample garments display directly for fast inspection, rotation, zoom and wireframe. GLB export runs only when Download is selected. Local GLB import accepts embedded assets up to 30 MB and rejects external asset requests. The sample models remain visibly stylized.
- Actual Meshy HTTP adapter: image-to-textured-3D, text-to-shape, and retexture an owned, completed Meshy task from an image or description. User-selected source tasks are resolved on the server. Task polling uses provider status/progress. Generated GLB files are downloaded through an authenticated bounded server proxy.
- Recent tasks persist in Firestore; inputs are sent to Meshy but their photo/prompt bytes are not stored by this adapter. Input fingerprints, ownership, creation time, provider task IDs and conservative credit reservations are stored. Provider retention applies separately.

## Required account setup

Copy the variable names from `.env.example` into a private `.env`, or configure them on your server. Never put the key in a VITE_ variable or commit it.

- `MESHY_API_KEY`: your Meshy API key with sufficient credits.
- `MESHY_MODEL`: a currently supported, explicitly selected image/text model. Do not use a moving `latest` alias for cost review.
- `MESHY_TEXTURE_MODEL`: a currently supported texture model for retexture.
- `MESHY_MAX_TASK_CREDITS`: reviewed upper-bound credits for one task under the exact selected options, covering both generation and retexture. This is an application reservation, not a provider-enforced billing ceiling. Recheck it when changing models or provider prices.
- `MESHY_DAILY_CREDIT_BUDGET`: total reserved credits across this application per UTC day.
- `MESHY_ALLOWED_UIDS`: comma-separated Firebase account IDs allowed to spend the pilot budget.
- Existing Firebase Admin account/storage configuration and functioning sign-in are also required.

No Meshy credentials or limits were configured when checked. No real Meshy request, credit charge, or generated bridal asset was run or verified.

Generation is currently a restricted, application-funded pilot, with three tasks per allowed account per day. It is not paid customer checkout. Public Meshy billing/entitlements still need implementation before allowing all users to spend credits.

Reservations happen in a database transaction before a paid provider submission. Duplicate request IDs do not resubmit; changed inputs with the same ID are rejected. Unknown submissions retain their reservation and need dashboard reconciliation. Do not retry them with a new ID without checking Meshy. There is no durable reconciliation worker yet. Each texturing step consumes a separate reservation.

## How to use

1. Run `npm run build`, then `npm run start:local` in the repository. Open `http://localhost:3001/modeling` or `http://localhost:3001/looks`.
2. Choose a sample and use **Preview sample in 3D**, or open an editable dress in Studio. These work without Meshy.
3. After server/account configuration, log in as an allowed account. Upload a reference or choose a dress prompt, provide content/credit consent and generate.
4. Wait for provider completion; load the generated model. **Apply a fabric design** creates a new retexture task against that model. Download successful results before provider URLs expire.

Meshy generation can interpret rather than exactly copy patterns, faces and embroidery. Retexture changes surface appearance; it does not reconstruct sewing patterns or guarantee isolated garment-only editing on a fused human/garment mesh. A generated model is separate from the measured Studio garment. Review the real result before making quality claims.

## Documentation used

- https://docs.meshy.ai/en/api/image-to-3d
- https://docs.meshy.ai/en/api/text-to-3d
- https://docs.meshy.ai/en/api/retexture

## Verification

Test results are recorded after the final checks below. Unit/API tests use mocked Meshy HTTP responses and local transactional storage; they do not prove live provider compatibility or production Firebase behavior.

Final verification for this update:

- TypeScript checking passed with `tsc --noEmit` (1.5 GB heap allowance); smaller forced heap limits failed from insufficient memory and were not counted as passes.
- Production frontend and server builds passed. The existing large-bundle warning remains.
- 37 API/domain tests passed, including five Meshy route tests using a mocked provider. These cover missing setup/auth/consent, account allowlists, concurrent duplicate submissions, daily limits, uncertain submissions, ownership, trusted asset download and owned-model texturing.
- 39 browser cases passed in one final run (3.8 minutes): measured Studio, reference UI and new modeling flows on 390×844, 768×1024 and desktop (1440×1000, with the reference test also using 1672×941).
- Six additional modeling cases passed on 320×800 and 1024×768, for 45 distinct browser cases across five device-size profiles. The three modeling cases verify local GLB validation/import, all 18 gallery entries/filtering/preset persistence, and representative lehenga/gown/blouse preview plus textured GLB download/re-import. The initial sample-preview timeout and navigation failure were followed by the final green runs above.
- Meshy credentials/account/model billing, real generated output, production Firestore transactions, physical-device testing and print/manufacturing accuracy remain unverified. No real provider credits were spent.
