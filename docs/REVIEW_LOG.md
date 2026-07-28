# SmartSpace Review Log

## Usage

This file is maintained by Review Agents. Append one review entry per implementation round. Do not rewrite the factual implementation record in `IMPLEMENTATION_HANDOFF.md`.

The Review Agent should begin with the assigned commit or commit range and the relevant work-package acceptance criteria. Repository-wide inspection is appropriate only when a changed contract or shared lifecycle requires it.

Findings lead the review. Avoid summaries of files that changed unless they are necessary to explain a defect.

## Severity

- `P0 - Critical`: Data loss, security breach, destructive process behavior, unusable release, or unrecoverable window/process corruption.
- `P1 - High`: Required behavior is broken, a common workflow regresses, or a serious lifecycle/race condition exists.
- `P2 - Medium`: Behavior is incorrect in a bounded case, error handling is inadequate, or meaningful test coverage is missing.
- `P3 - Low`: Concrete maintainability or usability defect with limited current impact.

Style preferences, speculative refactors, and unrelated pre-existing issues are not findings. A test-gap finding must explain which behavior could regress undetected.

## Review Outcome

- `Approved`: No blocking findings; the work package may be marked complete.
- `Approved with follow-up`: No P0/P1 findings; explicitly listed non-blocking work may be scheduled later.
- `Changes requested`: At least one finding must be fixed or explicitly accepted before completion.
- `Blocked`: The review cannot be completed because the commit range, environment, artifact, or required evidence is unavailable.

## Review Entry Template

Copy the section below and append it under `Review History` for each review.

```markdown
### Review YYYY-MM-DD - WP-XX

#### Review Metadata

- Review Agent: <identifier>
- Implementation commit or range: `<commit>`
- Handoff reviewed: Yes | No
- Review scope: <work package and any necessary adjacent components>
- Outcome: Approved | Approved with follow-up | Changes requested | Blocked

#### Findings

##### [P1] Short actionable title

- Location: `path/to/file.ts:line`
- Acceptance criterion or invariant: <requirement violated>
- Evidence: <specific execution path, reproducible behavior, or test result>
- Impact: <what fails and for whom>
- Required change: <minimum behavior needed to resolve the finding>

If there are no findings, write: `No actionable findings.`

#### Verification

| Check | Result | Notes |
| --- | --- | --- |
| Diff matches recorded scope | Pass/Fail/Not run | ... |
| Relevant automated tests | Pass/Fail/Not run | ... |
| Typecheck/build | Pass/Fail/Not run | ... |
| Manual acceptance checks | Pass/Fail/Not run | ... |
| Security/lifecycle review | Pass/Fail/Not applicable | ... |

#### Open Questions and Assumptions

- None.

#### Residual Risk

- <What remains unverified even if the review is approved.>

#### Required Follow-up

- [ ] `<finding-id>` <owner/action>

#### Resolution

- Status: Open | Fixed and verified | Accepted risk | Superseded
- Resolution commit: `<commit or not available>`
- Verified by: <reviewer or not yet verified>
- Notes: <brief evidence>
```

## Review Rules

1. Verify the commit boundary before reading implementation details.
2. Read the relevant section of `IMPLEMENTATION_TASKS.md` and the current `IMPLEMENTATION_HANDOFF.md`.
3. Check claims against code and tests; do not treat the handoff as proof.
4. Prioritize security, data integrity, process/window lifecycle, functional regressions, and missing tests.
5. Provide exact file and line references for actionable code findings.
6. Avoid requesting unrelated refactors or expansion into later work packages.
7. Rerun the narrowest relevant verification before accepting a fix.
8. Record skipped verification and residual risk even when approving.
9. A package with an unresolved P0 or P1 finding cannot be approved.
10. Do not expose secrets, user data, private machine details, or irrelevant command output in this log.

## Review History

### Review 2026-07-28 - WP-01

#### Review Metadata

- Review Agent: `Review Agent`
- Implementation commit or range: `6fd61b921a67378356db5bfa813a1e8f59065366..dc13995ea17eb4b21a99e19ffe36eb9a77b47458`
- Handoff reviewed: Yes
- Review scope: WP-01 Electron foundation, including the main/preload boundary, IPC contracts, build tooling, and startup checks
- Outcome: Changes requested

#### Findings

##### [P2] Validate the sender before dispatching IPC requests

- Location: `src/main/ipc/register-ipc.ts:8`
- Acceptance criterion or invariant: The Electron foundation must establish a secure, narrow IPC boundary; only the trusted SmartSpace renderer should be able to invoke main-process handlers.
- Evidence: The registered callback discards `_event` and forwards every `app:get-info` invocation based only on payload validation. It never verifies `event.sender`, `event.senderFrame`, or the sender URL against the main SmartSpace window. The current payload is harmless, but this registration pattern is the foundation for later repository, shell, and process-control handlers.
- Impact: Any renderer WebContents that gains access to a registered channel can invoke the handler. As privileged IPC operations are added, a compromised or unintended renderer could cross the renderer/main security boundary even when its payload is structurally valid.
- Required change: Reject calls whose sender is not the authorized SmartSpace renderer (for example, bind registration to the expected WebContents or validate the sender frame URL), return a structured error, and add a focused test for an unauthorized sender.

##### [P2] Make the empty request type reject malformed payloads

- Location: `src/shared/ipc.ts:8`
- Acceptance criterion or invariant: WP-01 requires typed IPC request conventions and a typed preload API for a validated request.
- Evidence: `AppInfoRequest` is declared as `Record<never, never>`. In TypeScript this is effectively an unconstrained empty object type, so a call such as `window.smartSpace.app.getInfo({ unexpected: true })` is assignable even though runtime validation rejects it as `invalid-input`.
- Impact: Renderer callers receive no compile-time feedback for malformed request fields, so the request side of the advertised typed contract is ineffective and can produce avoidable runtime failures.
- Required change: Represent this operation as a no-argument call or use an exact empty payload type that rejects properties, and add a compile-time contract test or equivalent type assertion covering an extra field.

##### [P2] Enforce the renderer import boundary beyond a fixed file list

- Location: `tests/security.test.ts:49`
- Acceptance criterion or invariant: The renderer cannot import Node.js, Electron main-process APIs, or SQLite directly, and WP-01 must establish that module boundary.
- Evidence: The test scans only `src/main.tsx`, `src/App.tsx`, and `src/motion.tsx`. `tsconfig.app.json` otherwise includes `src` broadly, and there is no lint rule, resolver restriction, or dependency-graph check preventing a newly added renderer module from importing a forbidden package while escaping this test.
- Impact: A renderer boundary regression can be introduced in an unlisted file without failing the baseline security test, undermining the security acceptance criterion as the renderer grows in later packages.
- Required change: Enforce forbidden imports across the actual renderer source boundary or dependency graph rather than a maintained filename list, and prove the enforcement with a negative fixture or equivalent test.

#### Verification

| Check | Result | Notes |
| --- | --- | --- |
| Diff matches recorded scope | Pass | `6fd61b9..dc13995` is one commit and contains WP-01 foundation code, tests, tooling, ADR, and handoff only. |
| Relevant automated tests | Pass | `npm test`: 2 files, 7 tests passed. |
| Typecheck/build | Pass | `npm run typecheck` and `npm run build` passed. |
| Manual acceptance checks | Pass | `node scripts/smoke-electron.mjs` passed; `$env:SMARTSPACE_SMOKE_TEST='1'; npm run dev` exited successfully after loading the development renderer through Electron. |
| Security/lifecycle review | Fail | Secure BrowserWindow preferences and navigation restrictions are present, but IPC sender authorization and durable renderer import enforcement are missing. |

#### Open Questions and Assumptions

- The failed `npm run package:dir` attempt recorded in the handoff was treated as a WP-10 packaging risk because WP-01 acceptance requires the production build and startup smoke path, not a validated packaged installation.

#### Residual Risk

- Packaged Windows behavior remains unverified, consistent with the handoff. The smoke checks verify startup and one valid bridge request but do not exercise an invalid request through the real preload/main transport.

#### Required Follow-up

- [x] `WP01-R1` Implementation Agent: authorize IPC senders and test rejection of an unauthorized sender.
- [x] `WP01-R2` Implementation Agent: make the app-info request type reject unexpected properties and add type-level coverage.
- [x] `WP01-R3` Implementation Agent: enforce forbidden renderer imports across the complete renderer boundary.

#### Resolution

- Status: Fixed and verified
- Resolution commit: `6c3704ad1d85d863398db0ff22f53e3d9db40a57`
- Verified by: `GPT-5.6 Sol review Agent`
- Notes: Re-review confirmed authorized `WebContents` identity checks, exact empty-request type coverage, and renderer-project-wide forbidden-import enforcement. All required automated checks and both Electron smoke paths passed.

### Re-review 2026-07-28 - WP-01

#### Review Metadata

- Review Agent: `GPT-5.6 Sol review Agent`
- Implementation commit or range: `f11e5179ef13ae9f3ddf56c4cbea811785bd6748..6c3704ad1d85d863398db0ff22f53e3d9db40a57`
- Handoff reviewed: Yes
- Review scope: WP-01 review-fix round for `WP01-R1`, `WP01-R2`, and `WP01-R3`
- Outcome: Approved

#### Findings

No actionable findings.

#### Verification

| Check | Result | Notes |
| --- | --- | --- |
| Diff matches recorded scope | Pass | The range contains one implementation commit limited to the three accepted findings, focused tests, and the implementation handoff. |
| Relevant automated tests | Pass | `npm.cmd test`: 3 files, 10 tests passed, including unauthorized sender rejection, compile-time request strictness, and the renderer-boundary negative fixture. |
| Typecheck/build | Pass | `npm.cmd run typecheck` and `npm.cmd run build` passed. |
| Manual acceptance checks | Pass | `node scripts/smoke-electron.mjs` passed; `$env:SMARTSPACE_SMOKE_TEST='1'; npm.cmd run dev` loaded the development renderer and exited successfully. |
| Security/lifecycle review | Pass | `app:get-info` rejects a sender other than the active window's `WebContents`; the request type rejects unexpected fields; the forbidden-import test derives its complete renderer file set from `tsconfig.app.json`. |

#### Open Questions and Assumptions

- The active SmartSpace renderer is intentionally identified by its `WebContents` object. Future multi-window or subframe IPC must define and authorize its own sender boundary rather than reusing this handler registration unchanged.

#### Residual Risk

- Packaged Windows behavior remains unverified and is deferred to WP-10. The Electron smoke check covers a valid request through the real preload/main transport; unauthorized sender and invalid payload paths remain covered by focused automated tests rather than a second real renderer.

#### Required Follow-up

- None.

#### Resolution

- Status: Fixed and verified
- Resolution commit: `6c3704ad1d85d863398db0ff22f53e3d9db40a57`
- Verified by: `GPT-5.6 Sol review Agent`
- Notes: `WP01-R1`, `WP01-R2`, and `WP01-R3` are resolved; WP-01 is approved.

### Review 2026-07-28 - WP-02

#### Review Metadata

- Review Agent: `GPT-5.6 Sol review Agent`
- Implementation commit or range: `b3670dc59e9ea86f1956e700e4d6abdd02e82c19..a85d43dbd00c3774a7f35c635a2db90cfbe741e3`
- Handoff reviewed: Yes
- Review scope: WP-02 quick-panel creation, shortcut registration/status delivery, window visibility and focus transitions, close/minimize/blur lifecycle, and adjacent typed IPC/preload contracts
- Outcome: Changes requested

#### Findings

##### [P1] Keep first-launch bounds inside smaller primary work areas

- Location: `src/main/shell/create-main-window.ts:26`
- Acceptance criterion or invariant: WP-02 requires the first launch to be centered in the current primary work area.
- Evidence: `getCenteredWindowBounds` clamps only the centering offset and always returns the requested `1180 x 760` size. For a common `1366 x 728` work area (for example, a 1366 x 768 display after the taskbar), it returns `{ x: 93, y: 0, width: 1180, height: 760 }`, placing 32 DIP below the work area. The focused test covers only a work area larger than the defaults.
- Impact: On common laptop displays, the first-launch panel is not contained or vertically centered in the usable desktop and its bottom content or resize affordance can be inaccessible behind the taskbar.
- Required change: Clamp the initial width and height to the primary work area before calculating the centered coordinates, define the behavior when the work area is smaller than the normal minimum, and add focused coverage for a work area smaller than one or both default dimensions.

##### [P1] Deliver initial shortcut conflicts after the renderer subscribes

- Location: `src/main/main.ts:51`
- Acceptance criterion or invariant: WP-02 requires shortcut conflicts to be visible and to leave a usable shortcut registered; an initial default-shortcut conflict has no previous usable registration, so its error delivery must be reliable.
- Evidence: The initial status is sent once from `did-finish-load` at lines 59-61, while `src/App.tsx:249` does not attach `onShortcutStatus` until a React passive effect runs. Electron renderer events are not replayed to listeners registered after `webContents.send`, and there is no status query, renderer-ready handshake, or preload-side buffer. If the load event reaches main before that effect subscribes, the conflict event is lost. The implementation does show the window in this state, but no later path republishes the explanation.
- Impact: When `Ctrl+Shift+Space` is already owned by another application, SmartSpace can open with no working global shortcut and no visible conflict message, leaving the user unable to understand or recover from the required conflict path.
- Required change: Make current shortcut status recoverable after renderer readiness, such as through a validated query/handshake or a preload-side replay buffer, and add a test in which the initial conflict exists before the renderer listener is attached.

#### Verification

| Check | Result | Notes |
| --- | --- | --- |
| Diff matches recorded scope | Pass | The exact single-commit range contains WP-02 shell/window behavior, its typed IPC and renderer integration, focused tests, and the implementation handoff; no later-package persistence, tray, SQLite, or native-host implementation was added. |
| Relevant automated tests | Pass | `npm.cmd test`: 4 files, 26 tests passed. Existing tests cover shortcut replacement retention, visible/focused toggling, blur modes, close/minimize guards, destroyed-window guards, payload validation, and sender authorization, but not the two failing boundary cases above. |
| Typecheck/build | Pass | `npm.cmd run typecheck` and `npm.cmd run build` passed. |
| Manual acceptance checks | Not run | Full interactive shortcut-conflict and blur acceptance was not run. `node scripts/smoke-electron.mjs` passed. A repository-external Electron probe verified that Windows restores `minimize -> hide -> show/focus` to `minimized=false`, `visible=true`, and `focused=true`; the probe was removed afterward. |
| Security/lifecycle review | Fail | New invoke handlers preserve active-`WebContents` authorization and validated payloads, and close/quit guards avoid ordinary process termination. First-launch containment and reliable initial-conflict delivery remain broken. |

#### Open Questions and Assumptions

- WP-07 owns shortcut recording and persistence, but WP-02 still owns reliable delivery of an initial default-shortcut conflict because no prior registration exists in that path.

#### Residual Risk

- Packaged Windows behavior and full manual shortcut/blur interaction remain unverified, consistent with the handoff. The startup smoke validates loading and the existing app-info bridge but does not exercise shortcut conflicts or real blur/close input.

#### Required Follow-up

- [ ] `WP02-R1` Implementation Agent: clamp and center first-launch bounds within smaller primary work areas and add boundary tests.
- [ ] `WP02-R2` Implementation Agent: make initial shortcut status delivery race-free and add late-subscriber coverage.

#### Resolution

- Status: Open
- Resolution commit: `not available`
- Verified by: `not yet verified`
- Notes: Both P1 findings must be fixed or explicitly accepted before WP-02 can be approved.
