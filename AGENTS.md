# Agent guidelines

This is security-critical code. Keep it minimal, more code means more attack surface.

The repo is public. Write for a reader who knows nothing beyond what is in the repo, and include nothing private or unreleased.

## Code style

- No optional parameters and no defaults.
- Never export local symbols.
- In contract files, doc blocks are the spec and state every constraint the types cannot.
- Comments say only what the code cannot, and say it clearly.

## Error handling

- Use `invariant` from `packages/auth/src/lib.ts` for a case that cannot happen.
- Prove the error with a test before adding a try-catch.

## Tests

- Every test proves one behavioral claim using a test oracle derived from an authority.
- The implementation under test is never an authority or test oracle.
- When no authority determines the expected behavior, ask the user.

## Documentation map

Take any piece of content and go down this list in order. The first match is where it goes.

1. `packages/auth/src/contracts.ts` and its tests: what the library does or guarantees.
2. `packages/auth/README.md`: how to use the library.
3. `README.md`: why the project exists and how it differs.
4. `AGENTS.md`: a rule every session must follow, whatever the task.
5. `.agents/skills/*/SKILL.md`: one kind of job, loaded only when doing it.
6. `examples/*/*/README.md`: how to run that example and what it shows.

`SPEC.md`, `docs/`, and `services/` are history, not authority.

## Prose style

- Use sentence case instead of title case.
- Avoid semicolons, colons, and dashes unless they clearly help deliver the message.
- Write plain, complete sentences that get to the point. Cut words, not grammar, and never build a narrative.
- Never write "OTP code", an OTP is the password.
