# Facefolio

A browser-local PDF photo roster to flashcard application. No API keys, backend, build step, or account integration required. The hosted app is owner-private.

## Run locally

From this directory:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4173 in a modern browser. ES modules and PDF workers require HTTP(S); do not open index.html with file://.

## Features

- Drop or choose a PDF, up to 25 MB and 80 pages.
- Match embedded photos to selectable text below each photo in grid rosters.
- Names, school/program/degree, class year, pronouns, explicit major labels, and additional notes.
- Edit any field, replace a photo, add or delete a person, and rename rosters.
- Photo-first flashcards with keyboard shortcuts, shuffle, and known/still-learning progress.
- Multiple-choice name quizzes with immediate feedback.
- Multiple decks, search, filters, local persistence, and JSON backup/restore with photos and progress.

## Privacy and limitations

PDF processing runs entirely in the browser using the bundled Apache-2.0 PDF.js 6.4.299 compatibility build. Nothing in the app sends PDF contents, portraits, or cards to a server. IndexedDB stores decks per browser and origin. Export a backup before clearing browser data or switching devices. Local preview and hosted app have separate storage.

The importer is a geometric layout parser, not facial recognition. It uses existing PDF image/text placement and does not identify people from appearance or guess missing fields. Review imported cards before studying. Major is blank unless explicitly labeled in the source; add it manually when appropriate.

Supported input is photo grids with names/details below each separate embedded image. Scanned PDFs, flattened page images, side-by-side table layouts, unusually encoded images, and complex layouts may need OCR or reformatting in a PDF editor. Count mismatches against a listed enrollment and skipped pages are flagged. A mismatch-free count is not a guarantee of every pairing's accuracy.

The original roster and extracted student data are not bundled with the app or committed to source.

## Verification

Tested against the supplied four-page roster: 30 + 30 + 30 + 23 = 113 cards, with school/program and class year on every card. Wrapped names were checked against the PDF. Browser checks covered import completion, portrait rendering, reveal, quiz scoring, search, editing, and persistence after reopening, plus narrow and desktop layouts.

For the optional fixture integration check, install `@napi-rs/canvas` in your development environment and run:

```sh
node tests/verify-roster.mjs /absolute/path/to/photo_roster.pdf 113
```

If using an existing external Node dependency directory, set `FACEFOLIO_NODE_MODULES` to that absolute directory. The test never uploads or stores the roster. JavaScript syntax checks:

```sh
node --check dist/app.mjs
node --check dist/parser.mjs
```

## Files

- `dist/index.html`: document shell
- `dist/style.css`: responsive styles
- `dist/app.mjs`: import workflow, persistence, roster editor, study and quiz UI
- `dist/parser.mjs`: PDF image geometry and nearby-text matching
- `dist/vendor/`: self-hosted PDF.js and license
- `.openai/hosting.json`: private Sites deployment identity
