# Browser regression tests

After `npm install` and `npm run build`, serve the repository with
`python -m http.server 4180 --bind 127.0.0.1` and open
`http://127.0.0.1:4180/test/sections-drag.html` in a browser.

The page must report `PASS`. It uses the built sections renderer with a small
native-grid fixture and physically moves card DOM nodes before applying the
updated configuration, matching Home Assistant's Sortable `rollback=false`.
It checks cross-section moves, sorting within a section, repeated rendering,
empty source sections, and preservation of unchanged sections. This is an
isolated regression test; it does not replace testing in Home Assistant.

Also open `http://127.0.0.1:4180/test/sections-path.html`. It checks the
configuration-path contract used by HA 2026.11.0 / frontend 20261028.4:
adding a card to the second section without changing other cards, section
editor paths, header/footer paths, the global add button and legacy indices.
The native contracts are referenced from Home Assistant's `hui-section.ts`,
`hui-grid-section.ts` and `editor/lovelace-path.ts` at tag `20261028.4`.
