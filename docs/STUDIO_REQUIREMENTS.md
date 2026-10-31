# Advanced Studio acceptance requirements

Reference: user-provided mobile flow and desktop fashion workspace images. The objective remains an advanced, usable, secure application with API integration added later. A rendered screenshot or a disabled placeholder does not prove a feature works.

1. Responsive emerald Studio workspace, split 2D/3D views and focused mobile modes; all visible controls must perform a real action or state their external dependency.
2. Editable garment components, size measurements, pattern dimensions, seam allowances, grain lines, cut quantities, selection/translation, layer visibility and locking.
3. Synchronized assembled garment preview on a parameterized avatar, camera rotation/zoom, real material settings and trims; clearly distinguish geometric/physics approximation from production fitting.
4. Fabric/material library, colorways and texture controls that change the preview; no invented material properties or unsupported simulation claims.
5. Local project library, durable autosave, undo/redo, named revisions, safe project import/export and recovery on storage failure.
6. Measured SVG pattern exports, tech-pack output, bill of materials and cost calculations driven by the actual project.
7. Real cloth preview controls and fit/ease readings where supported, with explicit engineering limits; no fake stress maps, percentages or photorealistic results.
8. Community/boutique sharing and permissions, gated paid API integrations, user/seller flows, and application navigation aligned with the mobile reference.
9. Security: bounded validated uploads, safe rendering/exports, private account data, no client-granted paid access, protected external integrations and cost controls.
10. Verification: domain tests for geometry/costs/history/security, real browser interaction tests at mobile/tablet/desktop sizes, visual inspection, accessibility checks, build/type checks and accurate implemented-versus-pending report.

## Implementation status — 31 October 2026

| Requirement | Current result | Remaining boundary |
|---|---|---|
| 1. Responsive workspace | Advanced `/studio`, split/focused views, phone-first canvas order, accessible named icon buttons; existing concept editor retained | Final multi-size browser run recorded in implementation report; physical devices/cross-browser/manual accessibility still required |
| 2. Editable patterns | Parametric components, dimensions/seams/cut counts, pointer/keyboard/numeric translation, visibility and locks | No arbitrary curve drafting, editable grain angle, rotation, dart/seam construction or grading |
| 3. Synchronized preview | Supported component meshes, measured mannequin, camera controls, material and trim synchronization | Geometric approximation; complex assemblies and accurate fit are not validated |
| 4. Materials/colorways | Presets, color, procedural texture/scale and surface settings; named full-project revisions preserve colorways | No uploaded custom texture library or calibrated real-world fabric properties |
| 5. Save/history | Account-scoped IndexedDB library, autosave, undo/redo, named revisions, safe switching and JSON recovery export | Local browser persistence only; cloud sync/encrypted device storage not implemented |
| 6. Review outputs | Calibrated measured SVG, printable tech pack, BOM CSV and project-driven packing/cost estimate | Pattern plotting requires calibration/tailor review; no optimized marker or physical-printer test |
| 7. Cloth/fit | Real bounded mass-spring skirt preview and circumference ease checks | Other parts remain geometric; no self-collision, production sewing solver, pressure map or fit guarantee |
| 8. Connected flows | Publishing/permissions, likes/ranking, paid try-on and boutique quote implementation with protected server routes | Credentials, approved catalog/boutique data and live acceptance tests await setup; pass is prepaid, not recurring |
| 9. Guardrails | Validated bounded files, escaped XML/safe CSV, explicit measurement consent, server-only payments/permissions, budget/price guards | Production moderation, coordinated-account abuse controls, distributed limits and operational reconciliation remain |
| 10. Verification | Domain/API tests, emulator rules/integration checks and five-size Chromium interaction/accessibility suite | See final verified totals and exact external-service limits in `IMPLEMENTATION_REPORT.md` |

The local supported studio is implemented. This is not a claim that every feature in the professional reference image, all production operations, or live integrations are complete. API-dependent AI, payments and photorealistic generation require later configuration and real acceptance testing. No fabricated result or fake pressure/accuracy score substitutes for these requirements.
