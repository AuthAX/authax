# Spike

## Decisions

- An OTP is verified against the request that asked for it, not the identifier. The requesting client holds a random ticket from `send`, and the OTP alone is useless without it. Signing in on another device is a magic link's job.
- The library generates every string it hands a client. OTP tickets, passkey challenges, and session tokens are random columns the library fills, never the app's ids. The app keys its tables however it likes.
- A different trade-off is a different factory. An OTP verified against the identifier, with nothing for the client to hold, would sit beside the ticket one rather than change it.
- The library is not extensible. It ships the strategies and sessions, and an app wires them and writes none of its own. `issueProof` and `consumeProof` are not exported, so an agent cannot shortcut sign-in through the library and have it look like proper use. Auth is what everyone gets wrong, agents most of all, so the scrutiny belongs in one place. A new strategy or session is a pull request.

## OTP lookup options

The identifier is the email address or phone number the OTP is sent to.

|  | Ticket | Identifier, one pending | Identifier, many pending |
| --- | --- | --- | --- |
| Verify looks up by | the ticket | the identifier | the identifier and the OTP together |
| Client holds between send and verify | the ticket | nothing | nothing |
| Typing the OTP on another device | does not work | works | works |
| A second request for the same identifier | stands beside the first | replaces the first | stands beside the first |
| A guess is tested against | one OTP | one OTP | every pending OTP for that identifier |
| Wrong attempts are counted on | the request row | the identifier row | a separate counter per identifier |
| Someone sees the OTP mid sign-in | useless without the ticket | usable with the identifier | usable with the identifier |
| A stranger requests an OTP for your identifier | yours is untouched | yours stops working | one more OTP that would work |

Ticket is the only option where an OTP is bound to the client that asked and where a stranger's request changes nothing for you. Identifier with one pending is the simplest for the app and the weakest against interference. Identifier with many pending has the costs of both and should not be built.

## Revisit

- Opening the library to bespoke strategies and sessions, by exporting `issueProof` and `consumeProof` or a `makeStrategy` factory around them. Either hands the shortcut back, so only on real demand.
