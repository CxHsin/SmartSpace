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

No implementation rounds have been reviewed yet.
