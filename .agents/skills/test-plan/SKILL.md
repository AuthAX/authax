---
name: test-plan
description: Plan test coverage for one contract unit at a time. Use when identifying covered, partial, missing, unclear, or out-of-scope behavioral claims before writing tests.
---

# Test plan

Produce a compact assurance inventory for one contract unit. A contract unit is a public factory, adapter, namespace method, parser, or similarly coherent behavioral boundary; it is not necessarily one physical file.

<!--
Moved verbatim from AGENTS.md on 2026-09-13, not yet integrated into this skill:

## Vocabulary

- Authority — the source that determines expected behavior, following the documentation map; e.g. a contract, requirement, governing standard, or user/domain expert
  Example: The contract says a token is expired only when `expiresAt < now`
- Behavioral claim — what must be true
  Example: A token is not expired when `expiresAt === now`
- Test oracle — the expected result or decision rule for a given case
  Example: `expired` is `false`, encoded as `expect(decoded?.token.expired).toBe(false)`
 -->

## Scope

1. Require the user to name one target contract unit. If the target is absent or ambiguous, ask before investigating.
2. Stay within that target. Do not rank gaps across the repository or propose work in unrelated modules.
3. Record cross-unit discoveries under `Parked follow-ups` without pursuing them.

## Responsibility boundary

Before inventorying claims:

1. Identify the behavior the target owns and its settled, separately testable collaborators from user requirements and the authoritative documentation and type structure identified by `AGENTS.md`. Implementation may reveal candidate boundaries, but never behavior or a test oracle; ask when ownership is unclear.
2. Inspect direct collaborator tests for delegated behavior required by the target. If required behavior lacks direct evidence, report `/test-plan <collaborator>` as a prerequisite and stop before the target inventory.
3. Inventory only target-owned policy, translation, validation, and observable wiring. Do not count collaborator conformance as target coverage or require internal call-count evidence.

<!--
Moved verbatim from AGENTS.md on 2026-09-13, not yet integrated into this skill:

Place each claim at the lowest contract unit that owns the behavior, and establish required collaborator coverage before wrapper tests. Wrapper tests cover the wrapper's policy, translation, validation, and observable wiring; collaborator conformance belongs in the collaborator's test file. Prove wiring through public outcomes, not internal call counts.
-->

## Claims and evidence

Gather behavioral claims from the authorities relevant to the target:

1. Requirements supplied by the user.
2. The authoritative contract and mechanism documentation identified by `AGENTS.md`.
3. Relevant threat-model decisions and governing standards.

Use the work queue to find known gaps and target tests to classify evidence. Collaborator tests establish prerequisites and prevent duplication; they never prove a target-owned claim. Existing tests and implementation do not determine expected behavior.

## Inventory

Build the complete behavioral claim inventory for the target. Group claims by the unit's real behavioral concerns or failure modes so the groups can orient the test file. Reuse sibling group names where they fit; never impose a fixed taxonomy. Include positive behavior, denial or failure behavior, boundaries, side effects, time, and concurrency only where the authorities require them.

Give every claim exactly one status:

- `Covered` — existing evidence directly proves the claim.
- `Partial` — evidence proves only part of the claim.
- `Missing` — the claim has no direct evidence.
- `Unclear` — no authority determines the expected behavior.
- `Out of scope` — an authority explicitly places responsibility elsewhere.

Number every claim sequentially in the report. The numbers are local references for selecting a claim from that report, not permanent identifiers.

For covered or partial claims, cite the relevant test by name and file. For missing or partial claims, briefly state the defect the evidence should catch. Do not invent requirements or add speculative edge cases.

## Output

Report an unresolved prerequisite after the responsibility boundary as `Prerequisite: /test-plan <collaborator> — <reason>`, then stop. Otherwise use this structure:

```text
Target: <contract unit>

Responsibility boundary
- Owns: <target responsibilities>
- Delegates: <collaborator → delegated responsibilities, or None>

<Behavior group>
- [<number>] <Status>: <claim>. <Evidence or brief gap reason>

Questions
- <Only genuinely unresolved requirements; omit when empty>

Recommended next test
- [<number>] <One missing or partial claim and its test oracle, with a short reason; or `None` when every claim is covered or otherwise resolved>

Parked follow-ups
- <Cross-unit discovery; omit when empty>
```

Keep each entry concise, but do not cap or sample the inventory. Completeness is local to the target.

Do not edit files, write test code, or propose implementation. Stop after the inventory so the user can approve the recommended test target or choose another.
