---
name: test-plan
description: Plan test coverage for one contract unit at a time. Use when identifying covered, partial, missing, unclear, or out-of-scope behavioral claims before writing tests.
---

# Test plan

Produce a compact assurance inventory for one contract unit. A contract unit is a public factory, adapter, namespace method, parser, or similarly coherent behavioral boundary. It is not necessarily one physical file.

## Vocabulary

- An authority determines expected behavior, following the documentation map in `AGENTS.md`. It can be a contract, user requirement, or governing standard.
- A behavioral claim states what must be true.
- A test oracle is the expected result or decision rule for a case, derived from an authority.

For example, a contract that says expiration occurs only when `expiresAt < now` supports the claim that equality remains valid. The oracle for a case at exactly `expiresAt` is that the value is not expired.

## Scope

1. Identify one target contract unit from the user's request and context. If the target is absent or ambiguous, ask before investigating.
2. Stay within that target. Do not rank gaps across the repository or propose work in unrelated modules.
3. Record cross-unit discoveries under `Parked follow-ups` without pursuing them.

## Responsibility boundary

1. Identify the behavior the target owns and delegates from the authorities relevant to it. Place each claim at the lowest contract unit that owns the behavior. Implementation may suggest boundaries, attack surfaces, or cases to investigate, but cannot determine required behavior or a test oracle.
2. Inspect relevant collaborator contracts and tests to distinguish delegated responsibilities from target-owned behavior. A settled collaborator contract is sufficient to plan target-owned tests using a contract-faithful fake. Missing collaborator tests are an evidence gap to park, not a prerequisite for the target inventory.
3. If unclear ownership or collaborator behavior prevents a claim's oracle from being determined, mark that claim `Unclear` and state the missing decision. Continue inventorying unaffected claims.
4. Inventory target-owned policy, translation, validation, and observable wiring. Collaborator tests do not prove target-owned claims. Target tests using a fake do not prove the real collaborator conforms. Prove wiring through observable outcomes rather than internal call counts.

## Claims and evidence

Gather behavioral claims from the authorities relevant to the target:

1. Requirements supplied by the user.
2. The authoritative contract and mechanism documentation identified by `AGENTS.md`.
3. Relevant threat-model decisions and governing standards.

For each claim, cite the contract file and symbol or section, the governing standard and section, or the explicit user decision that determines the expected behavior. For an unclear claim, cite conflicting statements or identify the missing requirement. Do not resolve a conflict by copying current implementation behavior.

Use a work queue, when available, to discover candidate gaps. Existing tests provide evidence, not authority for expected behavior. Neither a work queue nor implementation behavior can supply a missing requirement. Use threat analysis to expose missing decisions without silently inventing requirements.

Judge existing evidence by its setup and assertions, not its test name or passing status. Check that the case reaches the condition in the claim and that the assertions distinguish the required behavior from a violation. When a claim forbids a side effect, checking only the returned error is insufficient. One behavioral claim may need multiple assertions.

## Inventory

Build the complete behavioral claim inventory for the target from the available authorities. Group claims by the unit's real behavioral concerns or failure modes so the groups can orient the test file. Reuse sibling group names where they fit. Never impose a fixed taxonomy. Include positive behavior, denial or failure behavior, boundaries, side effects, time, and concurrency where required by the authorities.

Give every claim exactly one status:

- `Covered` means existing evidence directly proves the claim.
- `Partial` means evidence proves only part of the claim.
- `Missing` means the claim has no direct evidence.
- `Unclear` means the authorities do not determine an unambiguous expected behavior or responsibility.
- `Out of scope` means an authority explicitly places responsibility elsewhere.

Number every claim sequentially in the report. The numbers are local references for selecting a claim from that report, not permanent identifiers.

For covered or partial claims, cite the relevant test by name and file. For missing or partial claims, state the test oracle and briefly describe the defect the evidence should catch. Recommend one test based on the consequence of violating the claim and the evidence it would add.

## Output

Use this structure:

```text
Target: <contract unit>

Responsibility boundary
- Owns: <target responsibilities>
- Delegates: <collaborator → delegated responsibilities, or None>

<Behavior group>
- [<number>] <Status>: <claim>. Authority: <source>. Evidence: <test or gap>. Oracle and defect: <for missing or partial claims>.

Questions
- [<claim number>] <Unresolved requirement or responsibility; omit when empty>

Recommended next test
- [<number>] <One missing or partial claim and why it is next; or None with the reason no test can be recommended>

Parked follow-ups
- <Cross-unit discovery or missing collaborator evidence; omit when empty>
```

Keep each entry concise, but do not cap or sample the inventory. Completeness is local to the target and the available authorities. It does not establish that the requirements themselves are complete.

Do not edit files, write test code, or propose implementation. Stop after the inventory so the user can approve the recommended test target or choose another.
