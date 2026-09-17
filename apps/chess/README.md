# Chess

Correspondence chess for your workspace. A game is one native Starhive object carrying its own
position, so search, permissions and reporting apply to games without this app doing anything.

Phase 1: play — against a person or against the computer. Analysis and tournaments are designed in
`docs/chess-app-investigation.md` in the `starhive-development` repo, which is also where the
reasoning behind the model below lives.

## What you get

One surface, the `globalPage`: three tabs — **Play a game** (the two opponent choices, and open seats
to take), **Your games** (badged with how many are waiting on you) and **History** — with the board
taking over the page once you open a game.

It used to mount into three more: an `objectPanel` drawing the board on the game object itself, a
`widget` saying "Your move in N games" for a dashboard, and a `macro` block putting a live board in
a page. They are gone. Removing a module from `manifest.yaml` is what removes it from the product,
so an install that updates past 0.37.0 loses those mount points and any widget or block already
placed stops rendering — the games themselves are untouched, because a game was never in the block.

**The last two plies are lit on the board** — the newer one brightly, the one before it faintly. Two
rather than one on purpose: in a correspondence game you come back hours later wanting to see both
what your opponent played and what you played before it, and since moves alternate, the last two
plies are exactly one move from each side. When both plies end on the same square — a recapture — the
square keeps the brighter mark.

**A finished game can be reviewed inside Starhive.** The result card offers it, and a **Review game**
button sits under the board afterwards. The review steps through the game a move at a time with a
vertical evaluation bar beside the board, a standard annotation glyph on each move (`?!`, `?`, `??`) with what it cost, an accuracy score for **both** players side by side, and a clickable move list that follows along as
you step. It opens at the starting position and walks forward; arrow keys work, and Home/End jump to
either end.

The summary names both players rather than showing a single card headed "You". One card asks the
reader to trust an attribution they cannot check, and when it disagrees with the move list beside it
there is no way to tell which is wrong — two named rows can be read straight off against the flags.

Every position is evaluated once, in the browser, and the result is saved to the game object — so it
happens once for both players rather than once per person per visit, behind a progress bar. A
forty-move game is eighty-one positions, each searched to depth 14 under a 1.5s cap, so how long that
takes is the one number here that depends on the machine it runs on.

**The review is Stockfish at depth 14**, one line per position — see *Playing the computer* below.
That is the whole of what it can see, and it is a great deal more than the engine it replaced, whose
own ply-to-ply noise sat at 85cp in the worst case: above the 75cp inaccuracy threshold it was being
judged against, so it flagged half the moves of a game nobody erred in.

**An analysis records which engine produced it**, and one from any other engine is re-run rather than
trusted. That is what retires every analysis stored by the old built-in engine, without which old
games would keep showing numbers the current engine would disagree with. A stored analysis whose
length no longer matches the move list is ignored for the same reason.

**A finished game announces itself over the board**, not over the page: a card centred on the final
position saying whether you won, how it ended, and the PGN result. Closing it leaves the position
visible, which is what people want to look at next.

**The app is coloured from one place.** `src/chess/palette.ts` turns a hue plus the viewer's colour
scheme into a readable ground, hairline and foreground — the two new-game squares, the time controls
(blitz hot, rapid green, daily cool) and the level cards (a green-to-red ramp across the ladder) all
come from it. Derived rather than picked, because a pale wash that looks cheerful on white is
invisible on near-black, and the dark version is a deep muted ground with light ink rather than the
same colour dimmed.

**The two opponent squares are blue and green, pinned.** They used to be the workspace's brand hue
and one 140° from it, which meant their character was an accident of somebody's brand colour: a blue
workspace got blue and a dull pink, a red one got red and magenta. Blue and green are a pair whatever
the workspace is, and neither carries the "something is wrong" that red and amber mean everywhere
else on the screen. The workspace's colour has not gone anywhere — the board's own squares are still
derived from it, which is by far the larger surface.

**The foreground lightness is solved, not pinned.** The ground and hairline sit at fixed saturation
and lightness per scheme; the ink does not, because HSL lightness is not perceived lightness and
green is far brighter than blue at the same number. On the old fixed band blue read at 6.1:1 and
green at **3.7:1** — under the 4.5:1 AA floor, on cards whose whole job is to be picked. Now the
lightness walks away from its own ground until it clears 5:1, so every hue gets the value it needs
rather than the one blue happened to need. Checked across all 360 hues in both schemes; the worst
anywhere is 5.00:1.

**The board wears the workspace's colour.** Its squares are derived from the theme's `primary` — hue
only, with lightness and saturation pinned to values a chessboard works at (roughly lichess's 89%
against 56%). Derived rather than copied on purpose: painting the squares with a raw brand colour
would produce an unreadable board the moment a workspace chose a pale yellow or a near-black navy,
and `src/chess/boardTheme.ts` has a test asserting no brand colour can. A brand with no hue worth
keeping — a grey — falls back to Starhive blue rather than to a grey board.

The board sizes itself from the room it is given, the height of the window and a ceiling the caller
asks for — 720px on the page — with the move list beside it above 620px of width and underneath
below that. The arithmetic is `src/components/boardLayout.ts`, kept pure and
free of React so it can be checked.

## How a game works

**Two kinds of opponent.** A new game asks who you are playing before anything else. Against a
person the game goes into the lobby as an open challenge and waits; against the computer it starts
immediately at a level you pick.

**Picking a time control pairs you, it does not queue you.** Choose "3 min" and if somebody is
already waiting on three minutes you join them; only if nobody is does a new game get made. Without
that, two people who both want a three-minute game and both press the obvious button end up sitting
in two separate empty lobbies waiting for each other. Whoever has waited longest is paired first.

Two people can press it in the same second, and there is no lock to stop them — so a join is read
back before it is believed, and the one who lost the race makes their own game instead of being told
they are in one they are not. The lobby is index-backed, so a game created in the last second or two
is not visible to pair with yet; that is the floor, not a bug worth chasing.

**Seat-claiming, not invites.** An app cannot list workspace users — there is no `users.*` method on
the bridge — so there is no way to challenge a particular person. Instead you create a game, take one
seat and leave the other open; whoever opens it takes the empty one and writes their own id into it.
An open-challenges board rather than a DM.

**Colours are drawn, not assigned.** The creator used to take White every time, which meant one
player never had to answer 1.e4 and the other never opened a game in their life. The draw applies
against the computer too — so the engine sometimes has the first move, and makes it as soon as the
board is on screen.

**Nobody names a game.** A personal game is named after the people in it — the creator alone at
first, both players once somebody takes the seat. Typed names are for tournaments, which do not
exist yet.

**The board is not drawn until there are two players.** A challenge waiting for somebody shows a
lobby screen instead — who is waiting, which seat is open, the time control, and a Cancel button.
Drawing the board there would show the same starting position every game, which tells the waiting
player nothing and reads as though the game were already under way.

The empty seat is drawn as an empty seat: a dashed outline, no face. Starhive hands an app no
avatars and no user directory — `StarhiveUser` is an id, a name and an email — so there is nobody
real to show, and animating invented people would suggest candidates are being matched when in
truth the game simply sits in a list until somebody opens it. Your own disc is initials on a colour
derived from your id, so you are the same colour every time.

**A challenge nobody takes can be called off** — from its row's **⋯** menu in any list, or from the
board. Only your own, and only while nobody has taken the other seat; once a game is under way it is
not yours alone to end, which is what resigning is for. Cancelled is deliberately not finished: a finished game was played and has a result, a
cancelled one never had a second player. Walking away without pressing it leaves the challenge open,
which is the safer default — closing a tab should not destroy a game somebody was about to join.

**Every status change is a separate write, and never allowed to fail the thing it describes.** The
status used to ride along in the same `objects.update` as the seat being taken or the move being
played — so a transition space-manager refused took the whole write down with it, and pressing "Play
as Black" did nothing at all: the seat was never written because a badge could not be moved. The real
write now goes alone and the status follows it, swallowing its own failures.

**The status workflow is a projection, never a source of truth.** A workflow is provisioned once and
never updated — `ProvisioningService` skips any workflow whose key it already tracks — so a state
added in a later manifest version simply does not exist on an install that predates it, and asking
for a transition to it fails at runtime with nothing having warned you. New *attributes* are added on
upgrade, which is why cancellation is a `cancelled` attribute and only mirrored into the workflow
when the state happens to be there. Every status transition in this app is best-effort for the same
reason: a game must never become unplayable because its badge could not be moved.

**Turn is derived, never stored.** The FEN carries side to move, castling rights, en passant and both
clocks, so a move is a single `objects.update` of `fen` + `moves` + `result`. The workflow only moves
twice in a game — at the seat claim and at the end — which is the only time the app pays for the
extra `workflow.transitions` round trip a `WORKFLOW` write requires.

**The board polls, and an interval alone is not enough.** There is no push in the app platform, so a
live game re-reads itself with `objects.get` — straight to space-manager, strongly consistent — and
stops on a hidden tab. But browsers throttle `setInterval` hard in a window that is not in front
(Chrome to roughly once a minute), which is why the player who created a game and then looked at
another window went on "waiting for an opponent" long after somebody had taken the seat, while the
opponent's screen was fine. So a re-read is also triggered by the page becoming visible **and by the
window regaining focus** — the latter being the one that matters, because a window merely behind
another is often never `hidden`, just slowed down.

The lobby polls too. It used to fetch once and never again, so a game opened a minute ago was not
there and a claimed one still offered its seat.

**A refresh is not a load.** `useObjectQuery` and `useObject` raise their own `isLoading` on every
refetch while keeping the data they already have — correct for the hooks, wrong for a screen that
polls, which then flashes "Loading…" over a perfectly good list every few seconds. `useGames` and
`useGame` therefore report `isLoading` only until there is something to show, and expose
`isRefreshing` separately for the in-flight case. Nothing renders `isRefreshing`; a poll should be
invisible.

**The lobby does not, and cannot.** Its lists come from `objects.query`, which goes through the
search index and lags a second or two behind a write. Two things follow: creating a game opens it
directly rather than returning to a list that has not noticed it, and cancelling one hides it locally
(`useGames().forget`) while a delayed refetch reconciles — otherwise the Challenges count stays wrong
until you reload the page.

**Nothing referees.** Apps are frontend-only and the host writes what the iframe asks using the
player's own session, so no server validates a move. The app stores the full move history and
replays it on every load (`verifyHistory`): a position that does not follow from its own moves is not
drawn at all. Detection, not prevention — preventing it needs app-owned server code, which the
platform does not have yet.

## Playing the computer

**The computer is a worker in a player's browser.** There is no server to run an engine on, so the
app searches for a move in whichever browser has the game open. That sounds fragile and is not: the
trigger is the position itself, so a game left with the engine to move simply gets its reply the next
time anyone opens it.

**It is Stockfish**, compiled to WebAssembly and run in a worker — the lite, single-threaded build
(`stockfish-18-lite-single`, 7MB). It replaced a small negamax over chess.js move generation that
could not search past depth 3 in a reasonable time and whose own evaluations were noisy enough to be
their own problem.

Three things had to be true for it to run here, and each is worth knowing before touching this part:

- **The bundle policy has to allow `'wasm-unsafe-eval'`.** Without it `WebAssembly.compile` throws in
  an app iframe and no search ever returns. It is two string literals kept in sync —
  `BundleCsp.kt` in `app-platform-service` and `bundle_csp` in the `app_bundles` Terraform module.
- **The engine is not bundled.** `scripts/copy-engine.mjs` copies the two files into `public/engine/`,
  which Vite emits verbatim. It has to be a real file on the origin twice over: the bundle CSP has no
  `worker-src`, so it falls back to `script-src 'self'` and a `blob:` worker is blocked with no error
  at all; and the Emscripten glue locates its own `.wasm` beside itself at runtime.
- **The `.wasm` has to be served as `application/wasm`.** `WebAssembly.instantiateStreaming` rejects
  anything else, and the distribution sets `X-Content-Type-Options: nosniff`, so a wrong type cannot
  be sniffed back.

**Single-threaded, and that is not a tuning choice.** Multi-threaded Stockfish needs
`SharedArrayBuffer`, which needs cross-origin isolation: COOP/COEP on the bundle response *and* on
the host page, plus `allow="cross-origin-isolated"` on the iframe. None of that exists. The full
(non-lite) net is 108MB against lite's 7MB, and Stockfish's own guidance is that lite is the one to
ship — still far beyond any human, where the large one loads slowly enough to hurt.

**Stockfish is GPLv3.** Shipping it inside the bundle is distribution, which makes the app a
combined work under the same licence. This repository being public is what makes that tractable. A
server-side engine behind a `proxy` remote would not raise the question at all — running GPL software
as a network service is not distribution — which is one more reason that route stays on the table.

### What the ladder does with it

**One mechanism, all the way up.** Every rung runs the same search — depth 10, 32 `MultiPV` lines,
about 150ms, under a 2s cap that a normal machine never reaches. What separates them is `meanLoss`,
the centipawns a level intends to give away per move, applied by `pickByLoss` in
`src/engine/weaken.ts` over the ranked moves that search returns. Two dials is how the ladder was
non-monotonic the first time: a hand-written table had level 250 throwing away more than level 100.

**The constants come from games, and they used not to.** `meanLoss` is what a level *asks* to lose;
what it actually loses is about 0.7 of that, because `pickByLoss` plays the nearest available loss to
its target and in most positions nothing sits exactly there. Each rung's `meanLoss` was once solved
against *published* centipawn loss for that rating — what humans of that rating average — and that
was the whole problem, because matching a human's average error does not produce a player of that
strength. A human's error is concentrated in a few blunders around an otherwise accurate game; a
level that spends the same allowance evenly, move after move, is far weaker for the same average.

So every rung now plays for its number. Each one was matched against Stockfish's own
`UCI_LimitStrength`/`UCI_Elo` — calibrated by people who measure it — set to that rung's own value,
30–40 games, both colours, from a twelve-line opening book. One pairing per rung, `level L` against
`SF@L`, so the test never assumes Stockfish's *spacing* is true, only that each label it is handed
means something.

The first run found the whole ladder far below its labels, and the error growing with the rung:

| level | used to ask | played like | now asks | plays like |
|---|---|---|---|---|
| 1000 | 134 | 610 | 99 | **1035** |
| 1400 | 96 | 1099 | 61 | **1347** |
| 1700 | 73 | 1348 | 42 | **1602** |
| 2000 | 54 | 1675 | 30 | **1956** |
| 2200 | 45 | — | 25 | **2156** |
| 2500 | 38 | 2118 | 22 | **2465** |

A curve rather than a table of the answers, for the reason it always was: every term has a positive
coefficient and grows as the rung gets weaker, so no rung can come out weaker than the one below it,
and a hand-written table is how the ladder went non-monotonic the first time. The curve's linear term
earns its place at the top rather than in the fit — without it the power term collapses and 2400 and
2500 land on identical constants, which is the same "nobody can tell these apart" failure at the
other end of the ladder.

**The two ends are weaker evidence than the middle.** Everything from 1400 up was measured against
its own number directly. 1000 was measured against Stockfish's floor of 1320, which is as low as its
limiter goes, and below 1000 the curve is extrapolation. A 40-game match also carries around ±90 Elo
of noise, so a rung is honest to roughly a hundred points, not to one.

**The tail is what a level feels like, not the average.** `maxLoss` was four times the mean, which
was harmless against an engine that could not find a move that bad and ruinous against one that can:
level 1000 kept a respectable average while throwing a whole rook away every dozen-odd moves, which
is not what a 1000 feels like — it is what losing feels like. At 2.5x the mean, a 300cp move is gone
from every rung above 1200 and a 500cp one from everything above 750.

Stockfish's own `UCI_LimitStrength`/`UCI_Elo` calibrates the ladder but does not drive it: it floors
at 1320 and half this ladder is below that, so Elo-limiting above and loss-shaping below would be two
mechanisms meeting in the middle. It is a good ruler and a bad engine for this.

**What changed by moving off the built-in engine.** The dial and its units are the same; the numbers
feeding it are now true. The old engine's own noise was 15cp at best and 85cp at worst, which put a
level's intended error inside its engine's error. It also saturated — the bottom of the ladder could
not give away more than about 130cp however hard it was pushed, because at depth 2 it could not tell
which moves the bad ones were. Both are gone, so the weakest rungs are now genuinely as weak as they
always claimed: 100 will hang a piece, which is what a 100 does.

**The numbers are still aims.** Each rung now loses what a player of that rating loses per move,
measured — but centipawn loss is not the whole of playing strength, and nothing here has been played
against rated opposition. The ladder is fitted to a proxy, not to results.

**Strength depends on the device.** A search bounded by wall-clock on the player's own hardware means
a phone reaches a shallower depth than a laptop in the same second. The only route where 1500 means
the same thing everywhere is a server-side engine behind the same `Profile` — a `proxy` remote needs
no platform change, since the proxy is built and a remote with a fixed address and no credential is
callable with nothing stored. It costs running that service. Nothing above `src/engine/levels.ts`
would change.

## Clocks

A game against a person picks a time control: **Blitz** (3, 3+2, 5), **Rapid** (10, 15+10, 30) or
**Daily** (1, 3, 7 days). Computer games are untimed. The clock starts
when somebody takes the second seat — never while a challenge is waiting, or the creator would flag
against an opponent who never arrived. Running out loses the game.

**Bullet is not offered.** A clock wants the opponent's move the instant it happens, and this
platform has no push: every move is an HTTP write, and the other side learns about it on its next
poll, one to three seconds later. A one-minute game where a move arrives two seconds late is not a
one-minute game. Rapid tolerates the lag and Daily does not notice it; **Blitz is kept and is still
the roughest thing here** — the picker no longer says so, so it is said here instead.

**The clock is cooperative**, for the same reason move legality is: the client whose turn it is
subtracts its own elapsed time, and either player's client writes the flag when it sees one. Nothing
enforces it. Two machines' clocks also disagree by seconds or minutes, so a turn that appears to have
started in the future is read as zero elapsed rather than as a windfall for either side.

A **daily** control is a budget per *move*, not for the whole game — what correspondence players mean
by "three days a move", and the only shape that survives a clock nobody is watching for a week.

## What it provisions

A `Chess` space (`access: open` — with the default `restricted`, every read by anyone but the
installer is refused and no board loads), a `Game` workflow, and one type:

| Attribute | Type | |
|---|---|---|
| `title` | TEXT | The game's name, and its label |
| `white` / `black` | USER | The seats. Empty means open |
| `fen` | TEXT | The whole position |
| `moves` | TEXT | Space-separated UCI. **The one field that cannot be backfilled** — analysis is built on it |
| `result` | OPTION | PGN-standard: `*`, `1-0`, `0-1`, `1/2-1/2` |
| `status` | WORKFLOW | Open challenge → In play → Finished, or → Cancelled. Display only — see above |
| `cancelled` | BOOLEAN | The real record of a called-off challenge |
| `opponent` | OPTION | `Human` or `Computer`. A computer game has an empty seat that is not an invitation, so this cannot be derived from the seats |
| `level` | DECIMAL | The rating a computer opponent plays at |
| `timeControl` | TEXT | `3+2`, `1d`, … or empty for an untimed game |
| `whiteMs` / `blackMs` | DECIMAL | Each side's remaining time as of the last move |
| `turnStartedAt` | TEXT | Epoch ms at which the side to move started thinking |

## Running it

```sh
npm install
npm run dev        # http://localhost:4500
npm run tscheck
npm run build      # → ./build
npm run deploy     # build + publish via the CLI
```

Deploying needs the CLI on your PATH and an access token. Against a local stack the credential is the
`__Host-access_token` cookie from a signed-in browser session, not a PAT:

```sh
export STARHIVE_TOKEN='<__Host-access_token>'
```

## Known limits

- **Promotion is always to a queen.** The board offers `promotion: 'q'` on every drag because it
  cannot know in advance whether a move is one; chess.js decides whether it applies, and the history
  records what was actually played. Under-promotion needs the promotion dialog and is not here.
- **No draw offers or takebacks.** Resigning and running out of time are the only ways to end a game
  early.
- **Flagging is always a loss**, even against an opponent with no mating material — where the rules
  say draw.
- **Last write wins.** `BridgeObject` carries no version or ETag, so there is no optimistic
  concurrency. Chess is turn-based, so a genuine race needs both players moving in the same second.
- **The lobby reads 50 recent games** and sorts them in the browser rather than in StarQL, which
  would have to name attributes by their (renameable) display names.
- **Level numbers are aims, not measured ratings**, and strength varies with the player's device —
  see *Playing the computer*.
