# V12 — Intersect final verification and release preparation

You are the implementing software engineer for Intersect. This is a fresh Codex conversation against the existing repository. Complete the final planned version, verify the actual product, prepare its static distributable, update MASTER.md, and stop. Do not publish or deploy without a separate explicit user request.

## 1. Establish the actual starting point

Read applicable repository instructions, the latest repository MASTER.md, the complete version roadmap, V11 completion evidence, architecture/coverage notes, performance and accessibility budgets, dependency manifests/lockfiles, local runtime asset preparation, and existing release/build scripts. Inspect current changes and preserve unrelated user work.

A generated prompt does not prove its version was implemented. Reconcile recorded completion with actual files and evidence. Repair small prerequisite defects within this final phase. If a substantial core requirement remains incomplete, record the real blocker and resume point; do not turn a partially implemented product into a claimed finished release through documentation alone.

Locate and inspect the actual supplied reference image, normally docs/reference/20308.png. If unavailable, use the written design requirements for independent fixes and record the missing visual-reference verification. Do not invent a replacement image or reset the project master to its original seed.

Make a short execution plan, finish the independently authorized work, verify it, and report the final release status. Resolve routine reversible implementation choices yourself.

## 2. Objective and scope

Prepare a concrete, reviewable final static release candidate from the current working application. Close demonstrated defects, finish reference-based visual details, verify representative mathematical and user workflows, audit runtime network independence, account for redistributed open-source assets, and document clean build and static serving.

This phase is the final planned release gate. It is not authorization to replace the architecture, expand solver coverage indefinitely, add new features, or begin an unplanned version. Do not publish, push changes, create a public release/tag, change sharing, or connect a hosting provider unless explicitly authorized separately.

## 3. Final product contract

Use this checklist to reconcile the finished product with MASTER.md. Explicit newer user decisions recorded in the repository take precedence; report any material divergence instead of silently redefining completion.

| Area | Required final behavior |
| --- | --- |
| Architecture | Static files; all computation/rendering/storage in the browser; no backend, online solver, hosted AI, API, analytics, external runtime CDN/font/package provider |
| Input | Two free-form surface equations using real MathLive fields and integrated virtual keyboard; faithful parsing and useful unsupported/invalid messages |
| Mathematics | One simple verified exact r(t), exact valid parameter domain and explicit scope; no numerical substitute or universal-solvability claim |
| Explanation | Faithful educational steps initially collapsed; proved emptiness and uncertainty distinguished accurately |
| Direction | Forward / Reverse updates formula, domain, traversal and explanation consistently; animation illustrates the selected direction |
| Space | Right-handed Z-up; calculation/navigation region [-1000,1000]^3; origin-centered initial reference region [-50,50]^3 |
| Graph | Both original surfaces in fixed distinct translucent colors; exactly one active curve; usable mouse/touch navigation and reset |
| Styling/animation | One-time tracing with arrow and replay/pause; reduced-motion behavior; custom active-curve color editor with mouse/touch/keyboard equivalents |
| History | Bounded IndexedDB history; faithful one-activation restoration of inputs/results/direction/color; deletion, compatibility and failure handling |
| Interface | Minimal dark reference-based layout, readable mathematics, responsive mobile/tablet/desktop workflow, essential keyboard/focus access |
| Delivery | Reproducible build, bundled runtime assets and required notices, ordinary static serving at root/subdirectory paths, honest documentation |

Alternative parameterization counters, generation, and multi-curve overlays were removed. Do not reintroduce them from the reference image. The final direction labels are Forward / Reverse, superseding clockwise/counterclockwise.

No online searching. Use local repository evidence, installed documentation, and authorized dependency workflows. A static HTTP(S) host is a delivery mechanism, not a computation backend. file:// operation, offline refresh, installability/PWA, cloud synchronization, or universal device support are not agreed claims and must not be added to the release description without implementation and authorization.

## 4. Close final visual and usability defects

Review the actual working interface against the supplied reference at representative sizes. Preserve the mathematical scale and superseding controls rather than reproducing misleading pixels from a conceptual image.

- Align panel fields, keyboard affordances, segmented direction control, primary action, result, derivation, and history access with a consistent spacing/type system.
- Preserve a dominant graph and restrained dark hierarchy, fixed F/G colors, active curve readability, correct axis labels, and a compact legend.
- Inspect successful, empty, inconclusive, validation-error, runtime-error, graph-unavailable, history-empty/populated, and open color-editor states where relevant.
- Check long formulas, expanded steps, MathLive keyboard open, history drawer, mobile orientation changes, zoom/text scaling, focus outlines, and safe-area behavior.
- Remove dead controls, fake examples/history, leftover prototype copy, temporary debug UI, duplicated menus, and accidental implementation jargon from product flows.
- Ensure single/double-click swatch behavior and explicit touch/keyboard color editing remain coherent in the one-active-curve model.
- Fix actual clipping, illegibility, collisions, stale labels, popup obstruction, and overflow. Do not arbitrarily change the initial 100-unit reference region to make a radius-2 curve match the concept image's visual size.

Use actual screenshots/captures and inspect them. A file being generated is not visual verification. Keep fixes within the existing design and feature contract; do not undertake an unrelated redesign.

## 5. Mathematical regression gate

Run the existing meaningful mathematical suite and review its assertions. Retain exact membership/domain/scope invariants rather than freezing a particular formula spelling. Do not rewrite expected outcomes simply to accommodate a regression.

Verify the established V4 coverage includes representative:

- Plane/plane line, inconsistent planes, and dependent overlapping constraints.
- Reference cylinder/plane closed curve and a translated/scaled equivalent.
- Oblique plane/sphere and supported sphere/sphere reduction.
- A parabola, supported elementary non-polynomial curve, and a hyperbola/domain-gap case.
- Original-denominator exclusions that remain valid after simplification.
- Isolated-point and real-empty cases, a bounded-empty case outside ±1000, and one-component selection with honest scope.
- A controlled inconclusive/resource-limit case without converting failure into a mathematical absence proof.
- Forward/Reverse domain mapping for open/closed/half-open and separated intervals as already supported.

Recheck transformed inputs through the real pipeline where useful: equation reordering, rearrangement, nonzero scaling, coordinate permutation, and supported translation. Use a focused selection, not an unlimited fuzzing campaign.

Membership, real-domain validity, boundedness, nonconstant image, and coverage are different facts. Preserve the recorded verification scope. A passing sample plot does not certify exactness. Geometry must not connect exclusions or reinterpret an empty mesh as a proof.

Document actual supported symbolic strategies and limitations. Do not advertise “almost all equations,” globally simplest expressions, complete arbitrary implicit-surface topology, or all-device performance without evidence. A correct honest unsupported outcome is part of the product; it does not justify silently dropping previously required core coverage.

## 6. Final end-to-end workflow matrix

Exercise the actual production application and locally bundled workers/WebGL, not only mocks or development fixtures. Reuse existing tests and add focused coverage only for unresolved concrete risks.

| Workflow | Evidence required |
| --- | --- |
| Fresh successful calculation | Real MathLive entry/keyboard -> local initialization -> exact result/domain -> collapsed derivation -> two surfaces/one curve -> direction arrow |
| Warm subsequent calculation | No unnecessary runtime reinitialization; old graph/result cannot mix with the new snapshot |
| Forward/Reverse | Matching formula/domain/explanation and opposite trace; rapid toggles settle correctly |
| Error/unknown handling | Input errors, proved empty, inconclusive, cancellation and runtime failure remain distinct |
| Busy cancellation/recovery | Real synchronous worker work can be stopped; subsequent simple work succeeds; stale messages are rejected |
| Graph navigation | Mouse and available touch inputs, bounded target, reset, resizing and region/detail replacement remain coherent |
| Playback/color | Replay/pause, gaps/closed seam, reduced motion, preview/commit/cancel and accessible editing work without solving again |
| History | Commit Reverse and custom color, reload on a stable origin, reopen faithfully without unnecessary intersection solving, regenerate graph, delete/clear without resurrection |
| Failure resilience | Graph-only or storage-only failure preserves current mathematical use; worker/context recovery uses the documented path |

At minimum, run the reference pair and one domain-restricted/non-polynomial case through the user interface. Inspect actual visual frames or a short capture where animation direction matters.

Review mobile-sized portrait, a landscape/tablet layout, and desktop on named test profiles. Touch emulation is not physical-device testing. Automated accessibility tools do not establish universal screen-reader conformance. Report the actual platforms/input methods checked and any unverified boundaries.

## 7. Runtime independence and static-host audit

This is a required production gate, not a source-code grep alone.

1. Serve the production distribution with an ordinary static server, without an application API, special computation service, or mandatory cross-origin isolation headers.
2. Use a fresh browser context/cache and allow requests only to the application origin plus browser-internal mechanisms needed by the harness. Prevent external origins and observe both attempted and successful requests.
3. Exercise initial load, MathLive keyboard/fonts, Python runtime and packages, exact solving, geometry workers, graph, output math, animation/color editor, and history restoration.
4. Verify no third-party runtime request or fallback is attempted, including optional library features accidentally enabled. A blocked external request is still a defect if the app attempted it.
5. Check same-origin asset URLs, MIME requirements, lazy chunks, worker/WASM/package/font paths, and case-sensitive paths against the actual static output.
6. Repeat the relevant smoke flow beneath a non-root base path using the actual build configuration. Preserve ordinary static-host operation without rewrite rules if the app does not need routes.
7. Verify there is no required secret/environment variable, hosted account, remote calculation endpoint, runtime pip/micropip download, or vendor service.

Source and bundle inspection can support the audit and locate problems. Distinguish runtime URLs from harmless documentation links/license references. Do not delete source citations or license URLs merely because they are external text.

Do not add a service worker to make this test pass or promise offline reload. Local saved history and local computation do not automatically make the static files available when offline.

## 8. Reproducible build and concrete release package

Prepare the distribution from the exact final source state, after relevant corrections and verification. Respect the repository's package manager and lockfiles. Use an isolated clean checkout/staging directory when needed to check reproducibility without overwriting user work.

- Document and run clean dependency/setup, local runtime asset preparation, type-check/test, production build, and static-preview commands through authorized workflows.
- Record actual compatible dependency/runtime versions. Verify the runtime/package assets expected by the production loader are present; an index.html and a JS chunk alone are not a complete Pyodide release.
- Record the source commit if it exactly identifies the packaged source. If there are uncommitted changes, state that honestly and include a suitable source-state manifest; do not claim HEAD corresponds to the build or create commits/tags just to conceal the difference.
- Ensure a clean build does not depend on transient scratch files, absolute developer paths, unrecorded manual downloads, or a global installation absent from setup instructions.
- Build a static distribution archive with portable relative paths, such as dist/ or a clearly named release archive according to existing project conventions. Include required runtime assets and license notices, excluding unrelated source/private files, logs, caches, and accidental secrets.
- Provide a release manifest/checksum record listing the build identifier/source state, configured base path, runtime versions, files or archive checksum, and actual verification summary. Avoid self-referential hashes; generate checksums after final files are stable.
- Confirm the packaged archive extracts and serves as expected. The archived bytes must be the verified final distribution, not an earlier build.
- Keep the archive/build output location consistent with repository artifact conventions; do not check a large distributable into source control blindly.

Do not promise byte-identical archives across different environments unless that property is implemented and verified. Reproducibility here requires a documented repeatable source-to-working-static-build process with identified dependencies/assets.

## 9. Open-source license and asset inventory

Inspect actual installed/distributed assets and repository license decisions. Prepare a concise inventory of application dependencies and redistributed runtime/package/font assets, their versions, license identifiers/notice files, and how required notices are included.

- Use locally available package metadata and LICENSE/NOTICE files. Do not invent licenses, authors, copyright holders, or compatibility conclusions unsupported by the files.
- Account for Pyodide, Python/runtime components, SymPy and transitive packages actually shipped, Three.js/addons, MathLive/Compute Engine, fonts, and other included components rather than merely the top-level npm manifest.
- Carry required notices into the distributable and document their location. Do not bundle unrelated assets solely because they were installed during development.
- Preserve existing application license/owner decisions when explicit. If the application license or legal owner is unresolved, prepare the concrete inventory and all other authorized release work first, then ask the user for the missing choice. Do not silently grant a license on their behalf.
- A pending app license means the open-source release gate remains pending even if the technical static package is ready. Describe that exact limitation without implying the rest of the work stopped.
- Do not provide a blanket legal certification. Identify actual unmet notice/permission issues as concrete blockers rather than introducing hypothetical warnings.

The no-online-search restriction remains in force. If local license evidence is missing, record the unresolved asset and question rather than guessing.

## 10. Documentation for use and maintenance

Finish concise source-grounded documentation:

- README: what the app does, supported input conventions, real capabilities/limits, setup/build/preview, dependency/runtime asset preparation, and static hosting at root/subdirectory paths.
- Usage: entering F/G, Forward/Reverse, reading interval/scope, expanding derivation, graph gestures/reset, replay/reduced motion, color editing, and local history restoration/deletion.
- Mathematical limits: distinction between verified curve/selected branch/arc, proved emptiness, unsupported exact output and “could not determine”; no universal-solvability or global-simplicity claim.
- Browser/storage limits: graphics fallback, local origin-scoped IndexedDB, bounded retention, possible browser clearing, recorded version compatibility, and tested platform scope.
- Troubleshooting: actionable local-asset, initialization, timeout/cancellation, graphics and storage failures based on implemented behavior.
- Architecture/maintenance: actual entry points and boundaries, local-asset invariants, worker/geometry/result identity rules, data schema/migrations, test commands and measured budgets.
- Release evidence: named environment, commands/results, visual/runtime audit, source/build identity, known issues and precise unverified items.

Use final user-facing prose, not placeholders or instructions to a future author. Keep internal implementation details in development documentation rather than ordinary product screens. Do not duplicate all of MASTER.md in each document.

If a concise notice about mathematical scope/browser-local storage improves a real user decision, integrate it without an overwhelming first-run warning checklist. Do not add accounts, onboarding, export/import or cloud backup in this phase.

## 11. Proportionate verification and final status

Run required existing suites and the focused final checks. After a fix, rerun impacted checks and the final production smoke path. Broaden testing only to resolve an identified risk or fulfill a gate; avoid repeatedly running every optional test without a reason.

Compare performance against V11's documented budgets on the same named profiles and confirm final visual fixes did not introduce obvious regressions. Verify important keyboard/focus, contrast, reduced-motion and responsive states. Link existing valid evidence where reuse is sufficient; rerun checks affected by changes.

Classify unresolved issues explicitly:

- Release-blocking: broken required workflow, false mathematical claim/domain, loss/corruption of history, missing runtime assets, external-provider dependency, failed essential verification, or unmet license requirements.
- Verified limitation: genuinely unsupported symbolic family, finite-resolution geometry limits, or a documented untested platform boundary without a claim of universal support.

A limitation is not automatically a release blocker, but a failed agreed core requirement cannot be renamed a limitation to declare success. A missing required real-browser/WASM/network verification leaves the corresponding gate unverified. Record actual outcomes rather than expected ones.

## 12. Completion gate and MASTER.md handoff

V12 is complete when:

1. The agreed complete product workflow is implemented and representative final mathematical/UI regressions pass.
2. Actual reference-based visual review, required responsive/accessibility checks, and V11 budget/regression checks are completed with honest tested scope.
3. Real production execution and the external-request audit pass with all runtime assets served from the static distribution, at root and a configured subdirectory path.
4. A concrete portable static release candidate is built from identified final source and verified after packaging.
5. Redistribution notices and the app's approved open-source license are resolved; any unresolved license decision is reported as a pending release gate.
6. Setup/use/maintenance/release documentation is complete and reflects implemented behavior without unsupported promises.
7. MASTER.md records final phase status, source/build identity, actual artifact locations, versions, verification summary, known limits, pending decisions if any, and maintenance entry points.

Update MASTER.md in place. Preserve the version history and distinguish completed implementation from prompt generation. If all gates pass, mark the planned V1–V12 staircase complete and the static release candidate ready; publishing remains a separate user decision. If any gate is incomplete, mark V12 partial/blocked and give the precise resume action while preserving finished work.

Do not create V13, generate another phase prompt, or start deployment automatically.

## 13. Final response

Lead with the actual outcome: ready static release candidate, or the specific remaining blocker. Summarize what changed, checks and outcomes, material limits, MASTER.md location, and the concrete distributable/documentation paths. Provide clickable links supported by the implementing environment where available.

If a missing application-license/owner choice is genuinely required, ask only that question after presenting the completed reviewable technical package and explaining why that release gate remains pending. Do not ask again for permissions already provided or manufacture a deployment approval flow when deployment was not requested.

Stop after the report. Publishing and future maintenance work require a new user request.
