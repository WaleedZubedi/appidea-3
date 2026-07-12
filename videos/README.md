# Bixi video clips — drop them in this folder

Name your files like this so I can wire them up automatically. Whatever format you
have is fine for now (.mp4 / .webm / .mov) — just keep the names below.

| Filename        | What it should show                                   | When it plays                          |
|-----------------|-------------------------------------------------------|----------------------------------------|
| idle.mp4        | Bixi happy/content in his room (LOOPS)                | Default — both of you present          |
| drift.mp4       | Bixi a bit sad / drooping                             | One partner toggled "drifted"          |
| dormant.mp4     | Bixi fading / very low energy                         | Both partners gone                     |
| water.mp4       | Bixi being watered (his leaf perks up)               | Tapping the "Water" button             |
| feed.mp4        | Bixi being fed / happy chomp                          | Tapping the "Feed" button              |
| revive.mp4      | Bixi springing back to life (optional)               | Tapping "Revive" — falls back to idle  |
| tap.mp4         | A little reaction to being poked (optional)          | Tapping Bixi himself — falls back to feed |

Notes:
- Only `idle`, `drift`, `dormant`, `water`, `feed` are essential. `revive`/`tap` are optional.
- Use the SAME file extension for all of them if you can (I'll set up multiple `<source>`s if needed).
- If a clip has sound, tell me — by default they'll be muted so they can autoplay on phones.
