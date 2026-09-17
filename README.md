# AuthAX

Monorepo for [`authax`](packages/authax).

AX stands for agent experience. The name is AuthAX in prose and as the GitHub organization, authax as the package and repository name, and auth.ax as the domain.

- npm package [authax](https://www.npmjs.com/package/authax)
- npm organization [authax](https://www.npmjs.com/org/authax)
- GitHub organization [AuthAX](https://github.com/AuthAX)
- Domain [auth.ax](https://auth.ax)

## Examples

Example names combine the authentication flow and storage, with a transport suffix when needed. Convex examples use only the flow name because Convex provides the storage.

| Flow | TanStack Start | Next.js | Bun | Convex |
| --- | --- | --- | --- | --- |
| `otp` | [memory](examples/tanstack-start-react/otp-memory), postgres (planned) | [memory](examples/nextjs/otp-memory) | [memory-cookie](examples/bun-react/otp-memory-cookie), [memory-header](examples/bun-react/otp-memory-header) | [Convex](examples/convex-react/otp) |
| `passkey` | [memory](examples/tanstack-start-react/passkey-memory), postgres (planned) | — | — | — |
| `otp-passkey` | [memory](examples/tanstack-start-react/otp-passkey-memory), postgres (planned) | — | — | — |
| `otp-passkey-strict` | [memory](examples/tanstack-start-react/otp-passkey-strict-memory), postgres (planned) | — | — | — |
| `passkey-otp` | [memory](examples/tanstack-start-react/passkey-otp-memory), postgres (planned) | — | — | — |

Memory storage is for demos. Its state is local to each server instance and is lost on restart.

## Licensing

Licensing is per workspace. Each workspace states its license in its package.json and carries the full text in its LICENSE.md.

| Workspace         | License                                                  |
| ----------------- | -------------------------------------------------------- |
| `packages/authax` | [MIT](packages/authax/LICENSE.md)                        |
| `examples/*`      | [MIT-0](examples/bun-react/otp-memory-cookie/LICENSE.md) |
| `service`         | [UNLICENSED](service/LICENSE.md)                         |
