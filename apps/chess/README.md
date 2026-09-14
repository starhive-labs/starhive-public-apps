# Chess

Correspondence chess for your workspace. A game is one native Starhive object carrying its own
position, so search, permissions and reporting apply to games without this app doing anything.

Phase 1: play — against a person or against the computer. Analysis and tournaments are designed in
`docs/chess-app-investigation.md` in the `starhive-development` repo, which is also where the
reasoning behind the model below lives.

## What you get

| Slot | What it is |
|---|---|
| `globalPage` | Three tabs — **Play a game** (the two opponent choices, and open seats to take), **Your games** (badged with how many are waiting on you), **History** — and the board once you open a game |
| `objectPanel` | The board on the game object itself, so opening a game in Starhive plays it |
| `widget` | "Your move in N games", for a dashboard |
| `macro` | A live board inside a page. The block remembers its game with `useMacroState()` |

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
happens once for both players rather than once per person per visit. About 20 seconds for a forty-move
game, behind a progress bar. A stored analysis whose length no longer matches the move list is
ignored rather than mispaired, so a game analysed before its last move is simply re-analysed.

**What the review can and cannot see.** It is the same shallow engine, so it reports what it can
actually distinguish: a hung piece, a move into mate, a real swing in the position. It will not find
the subtle errors a strong engine would. Two numbers, measured rather than assumed — on Morphy's
Opera Game it flags four moves and scores both players in the nineties, correctly calling the queen
sacrifice the best move; on a well-played quiet game it flags nothing.

Getting there turned on one unobvious thing: **the quiescence cut-off has to be even.** An odd one
stops in the middle of an exchange, so the evaluation credits whoever captured last — a bias that
flips every single ply. At quiescence 3 the engine's own ply-to-ply noise was 85cp, above the 75cp
inaccuracy threshold, and the review flagged half the moves of a game nobody erred in. At quiescence
6 the noise is 15cp and the same game flags none. The playing ladder uses even values for the same
reason.

**A finished game announces itself over the board**, not over the page: a card centred on the final
position saying whether you won, how it ended, and the PGN result. Closing it leaves the position
visible, which is what people want to look at next.

**The app is coloured from one place.** `src/chess/palette.ts` turns a hue plus the viewer's colour
scheme into a readable ground, hairline and foreground — the two new-game squares (the brand hue and
one 140° from it), the time controls (blitz hot, rapid green, daily cool) and the level cards (a
green-to-red ramp across the ladder) all come from it. Derived rather than picked, because a pale
wash that looks cheerful on white is invisible on near-black, and the dark version is a deep muted
ground with light ink rather than the same colour dimmed. Tested at both schemes across six hues.

**The board wears the workspace's colour.** Its squares are derived from the theme's `primary` — hue
only, with lightness and saturation pinned to values a chessboard works at (roughly lichess's 89%
against 56%). Derived rather than copied on purpose: painting the squares with a raw brand colour
would produce an unreadable board the moment a workspace chose a pale yellow or a near-black navy,
and `src/chess/boardTheme.ts` has a test asserting no brand colour can. A brand with no hue worth
keeping — a grey — falls back to Starhive blue rather than to a grey board.

The board sizes itself from the room it is given, the height of the window and a per-slot ceiling —
720px on the page, 520 in an object panel, 400 in a macro — with the move list beside it above 620px
of width and underneath below that. The arithmetic is `src/components/boardLayout.ts`, kept pure and
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

**It cannot be Stockfish *in the browser*.** The bundle CSP is `script-src 'self' 'unsafe-inline'`
with no `'wasm-unsafe-eval'`, so WebAssembly will not compile in an app iframe at all. That rules out
running it client-side; it does not rule out reaching one. A `proxy` remote to a Stockfish service
would work today with no platform change — the proxy is built, and a remote with a fixed address and
no credential is callable with nothing stored. It costs running that service, and it is the only
route where a level means the same thing on a phone and a laptop. What is here instead
is a small negamax with alpha-beta, quiescence and piece-square evaluation over chess.js move
generation (`src/engine/`), running in a real worker file — never an inlined `blob:` one, which the
same CSP would block with no error.

**So the level numbers are aims, not measurements.** Measured in a middlegame with ~38 legal moves:

| search | time |
|---|---|
| depth 2, quiescence 4 | ~0.5s |
| depth 3, quiescence 2 | ~6s |
| depth 4 | ~60s |

Depth 3 is the practical ceiling. The ladder spends it like this:

| levels | search | what separates them |
|---|---|---|
| 100–500 | depth 1, instant | how much they mean to give away (320cp → 235cp a move) |
| 750–2500 | depth 2, ~2s a move | the same dial, all the way down to zero |

No rung searches three plies. It is affordable only for a level that never plays below its best —
ranking moves needs exact scores and exact scores need a root search 2.5x dearer — which briefly made
2500 think for seven seconds while 2400, intending to give away a single centipawn, answered in two.
A 1cp difference in intent is not worth a 3.5x difference in waiting, so the top rung gives up the
ply. Real strength up there is Stockfish, not tuning.

Up to about 1500 a rung genuinely plays like the number says. Above it the labels outrun the engine,
and the cards say so. Making the top half real needs two things in order: allow WASM in the bundle
policy (two string literals — `BundleCsp.kt:82` and `cloudfront.tf:42`, see the investigation doc
§3), then put Stockfish behind the same `Profile` interface in `src/engine/levels.ts`. Nothing above
that file changes.

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
- **Levels above 1600 are labelled "aims high"** on their card, because they are.
