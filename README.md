# Sottoportico Live

Gioco multiplayer nel locale Sottoportico (Piazzale Dante, Bestat, Taranto).

- Sito statico: `index.html` alla radice, nessun build.
- Stanza dal vivo: Supabase Realtime (canale `sottoportico-live`), configurato in `claude-shim.js`.
- Filodiffusione: player Spotify (iFrame API) e Bandcamp; `netlify/functions/bc.mjs` legge i link Bandcamp.

Su Netlify: Add new project › Import an existing project › GitHub › questo repository. Lascia vuoti build command e publish directory.
