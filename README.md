# Facefolio

A browser-local PDF photo roster to flashcard application. No API keys, backend, build step, or account integration required. The latest version runs locally. The older hosted version is private; these updates have not been published. Rosters stay in your own browser.

## Run locally

On macOS, double-click `start.command`. It opens Facefolio in your browser. Keep the Terminal window open while using the app; close it or press Control-C when finished. Python 3 is required. Use the same browser each time to keep access to saved rosters.

Or, from this directory:

```sh
python3 serve.py
```

Open http://127.0.0.1:4173 in a modern browser. ES modules and PDF workers require HTTP(S); do not open index.html with file://.

## Features

- Drop or choose a PDF, up to 25 MB and 80 pages.
- Match embedded photos to selectable text below each photo in grid rosters.
- Names, school/program/degree, class year, pronouns, explicit major labels, and additional notes.
- Edit any field, replace a photo, add or delete a person, and rename rosters.
- Photo-first flashcards with keyboard shortcuts, shuffle, and known/still-learning progress.
- Typed-name quizzes (the default) and optional multiple choice, with immediate feedback. Typed answers accept a full name or an unambiguous first/last name and ignore case, accents, punctuation, and spacing. Enter submits an answer, then advances to the next person.
- A Back to roster button on the PDF upload/update screen.
- Multiple decks, search, filters, local persistence, and JSON backup/restore with photos and progress.
- Update an existing roster from a newer PDF with an added/removed/matched preview. Unique original names retain progress, notes, and explicit edits; photos and unedited details refresh. Duplicate or changed names need manual review.
- Undo the most recent update. Failed or canceled imports leave the existing roster unchanged. Same-filename uploads prompt you to update an existing roster or create a separate one.

## Updating a roster

Upload a PDF to create a reviewable roster immediately. From that roster, click **Update roster**, choose the latest PDF, inspect the change summary, and click **Apply roster update**. You can also choose an existing roster in the upload destination selector. The roster stays in the same browser and keeps its title. Use **Undo last update** to restore the previous version.

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
node --test tests/*.test.mjs
```

## Files

- `dist/index.html`: document shell
- `dist/style.css`: responsive styles
- `dist/app.mjs`: import workflow, persistence, roster editor, study and quiz UI
- `dist/parser.mjs`: PDF image geometry and nearby-text matching
- `dist/roster-update.mjs`: unambiguous name matching, edit preservation, update planning, and undo snapshot
- `dist/vendor/`: self-hosted PDF.js and license
- `.openai/hosting.json`: Sites deployment identity
