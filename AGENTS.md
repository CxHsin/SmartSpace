# SmartSpace Agent Instructions

## 1. Start Here

Before changing or reviewing code, identify your role for the current round:

- **Implementation Agent:** implements exactly one assigned work package.
- **Review Agent:** independently reviews one completed implementation round.
- **Coordinator:** assigns work packages and resolves product or architecture decisions; it does not silently act as both implementer and reviewer.

If your role or assigned work package is unclear, stop and ask the user. Do not infer an assignment from repository state.

## 2. Document Ownership

| Document | Primary audience | Purpose | Write access |
| --- | --- | --- | --- |
| `docs/PRD.md` | All Agents | Product scope, behavior, architecture, and MVP acceptance criteria | Do not change unless the user explicitly requests a PRD change |
| `docs/IMPLEMENTATION_TASKS.md` | Coordinator and Implementation Agent; Review Agent reads the assigned package | Stable list of 10 work packages, dependencies, constraints, and acceptance criteria | Do not change during normal implementation or review |
| `docs/IMPLEMENTATION_HANDOFF.md` | Implementation Agent writes; Review Agent reads | Factual record of what the latest implementation round actually changed and verified | Only the Implementation Agent for the current round may replace/update it |
| `docs/REVIEW_LOG.md` | Review Agent writes; Implementation Agent reads the latest relevant findings | Independent findings, outcome, residual risk, and fix verification | Only the Review Agent appends or updates its review entry |

The three workflow documents have different authority:

1. `IMPLEMENTATION_TASKS.md` says what must be built.
2. `IMPLEMENTATION_HANDOFF.md` says what the Implementation Agent claims it built.
3. `REVIEW_LOG.md` says whether that claim is supported and what must be fixed.

When the documents disagree, the PRD and work-package acceptance criteria define the required behavior. A handoff claim or review approval does not override the PRD.

## 3. Required Reading by Role

### Implementation Agent

Read only the context needed for the assigned package:

1. This `AGENTS.md` file.
2. `docs/PRD.md`.
3. The summary, global constraints, assigned work package, and execution protocol in `docs/IMPLEMENTATION_TASKS.md`.
4. The latest relevant entry in `docs/REVIEW_LOG.md`, especially unresolved findings that affect the assigned package.
5. Relevant source files and tests.

Do not treat an old `IMPLEMENTATION_HANDOFF.md` as a requirement. Replace it with the current round's factual handoff when work begins, then complete it before review.

### Review Agent

Read:

1. This `AGENTS.md` file.
2. The assigned work package and global constraints in `docs/IMPLEMENTATION_TASKS.md`.
3. The current `docs/IMPLEMENTATION_HANDOFF.md`.
4. The identified implementation commit or commit range.
5. Relevant PRD sections, source files, and tests needed to validate the changed behavior.

Do not read or rely on the Implementation Agent's reasoning transcript. Do not assume the handoff is correct; verify its claims against the diff, implementation, and test results.

### Coordinator

Read all three workflow documents plus `docs/PRD.md`. Confirm dependencies and unresolved review findings before assigning a new package. Keep implementation and review as separate Agent runs.

## 4. Implementation Agent Workflow

The configured implementation model is the `luna` Codex profile (`gpt-5.6-luna`, `xhigh`). If that profile is unavailable, stop and report the error; do not silently substitute another model.

1. Confirm the repository has a Git baseline and a clean, identifiable starting point.
2. Confirm exactly one assigned `WP-XX` package and that its dependencies are satisfied.
3. Inspect relevant code before editing and preserve unrelated user changes.
4. Record the assignment, start time, and starting commit in `docs/IMPLEMENTATION_HANDOFF.md`.
5. Implement only the assigned package and directly related fixes.
6. Add or update tests in proportion to the risk.
7. Run the package's required checks, typecheck, and build commands.
8. Review the final diff for scope expansion, generated artifacts, secrets, and unrelated changes.
9. Complete every applicable handoff section, including exact commands, results, skipped checks, residual risk, and the review commit range.
10. Set handoff status to `Ready for review` only when all assigned acceptance criteria are implemented and required checks pass.

Ask the user before making a choice that changes product behavior, data-loss policy, process-termination policy, security boundaries, or the architecture described by the PRD.

## 5. Review Agent Workflow

The configured review model is `gpt-5.6-sol` with `medium` reasoning effort. A separate Review profile is not required.

1. Confirm the assigned work package and exact commit or commit range.
2. Reject the review as blocked if no reliable diff boundary exists.
3. Compare the diff with the assigned acceptance criteria and handoff claims.
4. Inspect adjacent code only when required to prove a contract, lifecycle, security, or regression issue.
5. Run the narrowest relevant verification; record checks that could not be run.
6. Prioritize data loss, unintended process termination, renderer/main security violations, window/process lifecycle defects, functional regressions, and missing tests.
7. Do not request unrelated refactors, future work packages, or stylistic preferences.
8. Append one entry to `docs/REVIEW_LOG.md` using its template and severity rules.
9. Use `Approved`, `Approved with follow-up`, `Changes requested`, or `Blocked` exactly as defined in the review log.
10. Do not modify implementation code during the review round unless the user explicitly assigns a separate fix round.

An unresolved `P0` or `P1` finding prevents approval. Every finding must include a tight file/line reference, violated requirement or invariant, evidence, impact, and minimum required change.

## 6. Fix and Re-review Cycle

When review requests changes:

1. A new Implementation Agent round fixes only the accepted findings and updates `IMPLEMENTATION_HANDOFF.md` with the new commit range.
2. The Review Agent verifies the fixes and updates the existing review entry's Resolution section.
3. Do not erase original findings; preserve the audit trail.
4. Do not start the next work package until blocking findings are resolved or the user explicitly accepts the risk.

## 7. Repository Rules

- Use `rg` or `rg --files` for search when available.
- Use `apply_patch` for manual file edits.
- Never revert unrelated user changes.
- Never use destructive Git or filesystem commands unless the user explicitly requests them.
- Keep renderer access behind the typed preload API; the renderer must not access Node.js, Electron main APIs, or SQLite directly.
- Do not claim arbitrary executable compatibility or successful packaged behavior without recorded verification.
- Do not include secrets, credentials, private runtime data, or unnecessary machine-specific paths in workflow documents.

## 8. Commit Messages

Use Conventional Commits:

`<type>(<scope>): <subject>`

The scope may be omitted for a genuinely cross-cutting change:

`<type>: <subject>`

Allowed types:

- `feat`
- `fix`
- `refactor`
- `perf`
- `docs`
- `test`
- `build`
- `ci`
- `chore`
- `style`
- `revert`

Prefer short, stable SmartSpace scopes such as:

- `shell`
- `window`
- `tray`
- `shortcut`
- `tasks`
- `categories`
- `tags`
- `data`
- `ipc`
- `host`
- `settings`
- `ui`
- `packaging`
- `docs`
- `review`

Commit subjects must be written in English, use imperative present tense, describe the actual change, and have no trailing period. Avoid vague subjects such as `review fixes`, `cleanup`, `misc updates`, or `various improvements`.

Good examples:

- `feat(shell): add shortcut-controlled quick panel`
- `feat(data): persist task lifecycle in SQLite`
- `fix(host): restore window styles before process exit`
- `docs(review): record WP-03 review outcome`

Add a commit body only when the reason is not clear from the diff. Explain why the change is needed, the high-level approach, and any migration, compatibility, lifecycle, or follow-up risk.

## 9. Commit Boundaries

- Do not mix unrelated work packages or unrelated fixes in one commit.
- An implementation round should produce one reviewable commit or a small, explicitly recorded commit range for its assigned `WP-XX`.
- Include the completed `IMPLEMENTATION_HANDOFF.md` in the implementation round's final commit so the recorded range and verification travel with the change.
- Keep behavior changes, mechanical formatting, dependency updates, generated artifacts, and broad refactors separate when practical.
- Review-only documentation must not be folded into the implementation commit. A Review Agent should commit its `REVIEW_LOG.md` entry separately with a message such as `docs(review): record WP-03 review outcome` when a commit is requested.
- Fixes for accepted review findings belong in a new implementation commit or range. Do not rewrite the reviewed commit unless the user explicitly requests history rewriting.
- Do not create commits, push branches, or open pull requests unless the user has requested that action or the current assigned workflow explicitly requires it.

## 10. Pull Requests

Do not create a new branch solely to open a pull request. Use the current branch unless the user explicitly asks for another branch.

Do not use AI model or Agent names in branch names, including `codex/`, `luna/`, `sol/`, `claude/`, or `gemini/`. When a prefix is useful, use a change-oriented prefix such as `feat/`, `fix/`, `docs/`, or `chore/`.

PR titles follow the same Conventional Commit format as commit messages because the title may become the squash-merge commit subject. Write the title and subject in English, keep them short and specific, and use a stable scope when applicable.

PR descriptions must be written in Chinese and include:

- the work package ID and a concise behavior summary
- the implementation commit or commit range
- how the change was verified, including commands and relevant manual checks
- the Review outcome and any remaining `P2` or `P3` follow-up
- notable security, data, process-lifecycle, compatibility, migration, or rollout risk
- related issues when applicable, such as `Closes #123`

For UI changes, include screenshots or a short recording when they materially help review. For native hosting changes, include the tested Windows version, DPI/display setup, target application/version, and observed host/fallback state. For persistence changes, describe migration and rollback verification.

A PR is not ready to merge when:

- `IMPLEMENTATION_HANDOFF.md` is incomplete or does not identify the reviewed commit range.
- The latest Review outcome is `Changes requested` or `Blocked`.
- Any `P0` or `P1` finding remains unresolved.
- Required checks were skipped without an explicit user-approved exception.

## 11. Dependencies and Tooling

Do not introduce or replace dependencies, native modules, build tools, packaging tools, or workflow automation casually.

When such a change is required, explain it in the commit body or PR description and record its impact on security, maintenance, binary size, renderer bundle size, native rebuild requirements, build time, packaging, and Windows compatibility as applicable.

## 12. Pre-submission Checklist

Before committing an implementation round or submitting a PR, confirm that:

- the diff matches exactly one assigned work package or an explicitly assigned review-fix round
- relevant tests have been added or updated and executed
- `npm run typecheck` passes
- `npm run build` passes
- any additional work-package-specific verification is recorded in `IMPLEMENTATION_HANDOFF.md`
- packaged Windows smoke testing is recorded when the change affects Electron packaging, native modules, startup, elevation, or installation
- no temporary logs, debug code, local databases, generated test artifacts, secrets, or unrelated files are included
- relevant documentation, migrations, IPC types, and configuration changes are included with the behavior they support
- the Review outcome and unresolved findings are represented accurately in the PR description

## 13. Merge and Attribution

Prefer squash merge unless there is a clear reason to preserve individual commits. The final squash commit title must follow the Conventional Commit rules above.

Do not add AI attribution trailers such as `Co-Authored-By` for Agent assistance. Preserve genuine human authorship trailers only when they are actually required for collaboration history.
