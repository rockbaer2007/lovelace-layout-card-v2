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
