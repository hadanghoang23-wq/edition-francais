# Édition

A personal, offline-first study app (PWA) for learning French from your own textbook:
shadowing studio with intonation overlay, phonetics lab for Vietnamese speakers,
and FSRS vocabulary review.

This repository contains **only the app shell**. It ships with no textbook text or audio:
content packs are generated privately and imported on the device into IndexedDB.
The build fails if any textbook content is found in `dist/` (`scripts/check-no-content.mjs`).

```bash
npm ci
npm run dev     # local development
npm test        # engine tests
npm run build   # type-check + build + content check
```
