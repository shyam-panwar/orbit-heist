# Orbit Heist — build record

## Product brief

Build a social space-strategy game for 2–6 people on separate phones or laptops. A host creates a crew and shares a short room code. Everyone makes a secret sector choice each round; six rounds decide the crystal leaderboard. No account or installation is needed once the site is public.

Each sector has a crystal pool and a stated storm probability. Pilots in the same sector divide its pool equally, rounded down. A storm pays zero unless a pilot used one of their two shields. Fewer rivals can mean a bigger share; a higher bounty also carries risk. Missing the 45-second server deadline earns zero for that round.

## Build choices

- A shared D1 database stores canonical room state. Revision-checked updates handle simultaneous player actions.
- Private player tokens are returned only to their owner; only token hashes are stored. Opponent choices and future storm outcomes are omitted from room responses.
- Browser tabs keep separate session credentials. A tab refresh resumes its seat; an invite link contains only the room code.
- HTTP polling synchronizes screens; this implementation does not claim to use WebSockets.
- Rooms stop accepting access after two hours. Nicknames and scores are game data; no contact details or private application records are requested.
- Authored CSS/SVG planets and orbital artwork keep the interface independent of external image or font services.

## Real debugging iteration

Independent testing found that a lobby could lose its only host: after the host left, new players could join but nobody could start. The join flow now promotes the first new active player to host and marks that host ready. A regression covers leaving an empty lobby and rebuilding its crew.

## Validation record

- Backend tests cover scoring, privacy, simultaneous revision conflicts, player limits, late/stale actions, shields, host transfer, rematch and expiry.
- An independent scoring oracle checks all first-round sector allocations for 2–6 players under calm/storm fixtures (2,178 cases).
- TypeScript checking and the production framework build pass.
- Real HTTP tests against the built local Worker and D1 completed a six-round match, concurrent joins, authentication, hidden choices, rematch and host recovery. A separate real 45-second deadline test confirmed that a late choice is rejected while scoring commits exactly once.
- Two independent browser tabs completed all six rounds, verified a shielded storm payout, resumed the seat after reload, returned to the lobby for a rematch, opened/dismissed the rules dialog and left the room. This is a two-session browser test; two separate physical devices have not been tested.
- Browser screenshots and the mission-entry handoff are saved under the task's outputs/orbit-heist directory. Production availability is checked separately after deployment.

This is an AI-assisted original learning project prepared for Shyam Panwar's Handshake multiplayer game mission. It uses fictional crystals and outcomes, with no payments or monetary rewards inside the game.

## Flight School iteration

The published contest rubric gives equal weight to execution, creativity, value, and polish. A concrete usability gap was that a solo reviewer needed another person before experiencing the core game. Flight School now starts immediately with three labelled simulated rivals and contextual lessons. Opponents commit before the human chooses, using preferences and previously revealed traffic; they never inspect the human's current choice or future storms.

The flight computer explains how sharing and shields change a payout. An interactive replay reconstructs each player's score from actual historical gains, with a personal debrief and a copyable result. This emphasizes learning from a match rather than making unsupported claims about optimal play.

Three added tests cover six-round training, precommitted opponents, shields/rematch reset, deadlines, and historical replay/debrief calculations. Browser QA completed all six training rounds, rewound the replay, exercised copy feedback, started a rematch, and then created a real multiplayer lobby with no simulated players. A transient 46-second initial countdown was observed and bounded to the documented 45 seconds. A header Try solo button makes instant play visible above the fold.
