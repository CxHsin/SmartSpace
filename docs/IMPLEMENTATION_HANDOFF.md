# SmartSpace Implementation Handoff

## Usage

This file contains the handoff for the most recent implementation round. The implementation Agent owns it and must replace the template fields with factual, verifiable information before requesting review.

Keep only the current round in this file. Git history is the archive. Do not copy long source files, command logs, or reasoning transcripts into this document.

Use `None` when a field is genuinely not applicable. Do not use `None` for skipped verification or unfinished work.

---

## Current Round

### Assignment

- Work package: `Unassigned`
- Implementation Agent: `Unassigned`
- Started at: `YYYY-MM-DD HH:mm TZ`
- Completed at: `In progress`
- Starting commit: `Not recorded`
- Review commit or range: `Not available`
- Handoff status: `Draft | Ready for review | Incomplete | Blocked`

### Intended Scope

Summarize the assigned outcome and list the acceptance criteria targeted in this round.

- Not recorded.

### Constraints Applied

List only constraints that materially affected this implementation. Include relevant PRD rules, architecture boundaries, platform assumptions, or decisions inherited from an accepted review.

- Not recorded.

### Work Completed

Describe observable behavior that was actually implemented. Use concise statements that a Reviewer can verify in code or by running the application.

- No implementation round has been recorded yet.

### Files Changed

List files grouped by purpose. Explain why each group changed; do not reproduce the diff.

| File or directory | Change type | Purpose |
| --- | --- | --- |
| None | None | No implementation round has been recorded yet |

### Key Implementation Decisions

Record decisions where a reasonable alternative existed and where the choice affects future packages, compatibility, security, data, or process lifecycle.

| Decision | Reason | Consequence |
| --- | --- | --- |
| None recorded | Not applicable | Not applicable |

### Data and Contract Changes

Record migrations, schema changes, IPC additions or changes, preload API changes, configuration changes, and compatibility implications.

- Database migrations: None recorded.
- IPC/preload contracts: None recorded.
- Configuration/build changes: None recorded.
- Backward compatibility: None recorded.

### Verification Performed

Use exact commands and report the result. For manual checks, specify the environment, steps, and observed result. A command that was not run must be marked `Not run` with a reason.

| Verification | Result | Evidence or notes |
| --- | --- | --- |
| `npm run typecheck` | Not run | No implementation round recorded |
| Automated tests | Not run | No implementation round recorded |
| `npm run build` | Not run | No implementation round recorded |
| Manual acceptance checks | Not run | No implementation round recorded |
| Packaged Windows smoke test | Not applicable | Required only when the work package affects packaged behavior |

### Problems Solved

Link each solved problem to an acceptance criterion, previous Review finding, or reproducible defect when possible.

- None recorded.

### Known Issues and Residual Risks

Include flaky behavior, untested environments, compatibility uncertainty, deferred cleanup, and assumptions that the Reviewer should challenge.

- No implementation round has been recorded yet.

### Incomplete or Blocked Items

An empty section means the implementation Agent claims the assigned package is complete. Otherwise, explain the blocker, impact, and exact next action.

- No implementation round has been recorded yet.

### Scope Deviations

List work added or omitted relative to the assigned package. State who approved any material behavior or architecture change.

- None recorded.

### Reviewer Focus

Point the Review Agent toward the highest-risk code paths and uncertain assumptions. Do not tell the Reviewer what conclusion to reach.

- Confirm that the recorded commit range contains only the assigned work package.
- Validate every claimed acceptance criterion against the implementation and tests.
- Check whether any verification listed as passed is incomplete or ineffective.

### Suggested Review Commands

Provide the smallest command set that reproduces verification and exposes the changed behavior.

```powershell
npm run typecheck
npm run build
```

### Review Readiness Checklist

- [ ] Work package and commit range are recorded.
- [ ] The diff contains no unrelated changes.
- [ ] Completed behavior is described factually.
- [ ] Changed files and contracts are listed.
- [ ] Required verification was run and results are recorded.
- [ ] Known issues and skipped checks are explicit.
- [ ] No secrets, credentials, private paths, or sensitive runtime data are included.
- [ ] Handoff status is `Ready for review`.
