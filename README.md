# The Hidden Energy System

A live multiplayer quiz for a nutrition class. One big screen runs the show on a
continuous whiteboard; everyone plays on their phone with just a nickname.

Three rounds (what you eat, how your body powers itself, how your cells repair
themselves), twelve questions, a bonus question (closest guess wins $300,000) and a winners' podium. Players bet a share of their money on each answer; the richest player wins.

## Run it in class (your laptop)

```
npm install
npm start
```

Open `http://localhost:3000/host` on the projector. The lobby shows a QR code
and a game code. Phones on the same Wi-Fi scan it and join.

If your school Wi-Fi blocks devices from reaching each other, deploy it instead.

## Deploy it (free)

Any Node host works. With Render: push this folder to a GitHub repository,
create a new **Web Service** from it (the included `render.yaml` sets it up),
and open `https://<your-app>.onrender.com/host`. Set `PUBLIC_URL` to that
address if the QR code should show it explicitly.

## Presenting

| Key | Action |
| --- | --- |
| Space / Enter / → | Start, and move on after reveals and leaderboards |
| M | Mute |
| F | Fullscreen |
| B | Add 8 practice bots (lobby only) |

Click a name in the lobby to remove a player. A reloaded host screen or phone
picks up where it was. `/host?bots=8&speed=2` rehearses with bots at double speed.

## How it works

- `shared/content.js`: every question, hint and reveal from the proposal.
- `shared/engine.js`: rooms, the 30-second timer, scoring (100/200/300 XP, no
  speed bonus), private hints (two per game, one per question), bonus tie-break.
- `server.js`: static files plus WebSockets. One dependency (`ws`).
- `public/src/host/`: camera, whiteboard layout and the show's timing.
- `public/src/player.js`: the phone.
- `npm test`: engine tests. `node test/e2e.mjs`: plays a full game in a browser.
- `npm run build`: a one-file preview with practice bots (`dist/preview.html`).

Optional recorded sounds: add `public/sfx/<name>.mp3` and list the names in
`public/sfx/manifest.json` (`whoosh`, `pop`, `tick`, `reveal`, `correct`,
`wrong`, `sting`, `fanfare`, `drumroll`, `lock`). Otherwise sounds are synthesized.

## Test-mode buttons

Hover the top-right corner of the big screen for **Whole board** (fly through
every screen of the show, for checking) and **Restart** (everyone back to the
lobby with $100,000). Phones have a **Leave** button. Whole board is for
testing and will be removed in the final cut.
