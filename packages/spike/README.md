# Spike

## Decisions

- An OTP is verified against the request that asked for it, not the address. The requesting client holds a random handle from `send`, and the code alone is useless without it. Signing in on another device is a magic link's job.
- The library generates every string it hands a client. OTP handles, passkey challenges, and session tokens are random columns the library fills, never the app's ids. The app keys its tables however it likes.
