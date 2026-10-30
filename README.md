# RoleFit — Early Preview

RoleFit is a concept for aligning a CV to a job description. This repository
contains an **Early Preview**: an interactive walkthrough built on **prepared
example CVs, job descriptions and results**. It is meant to let people see the
proposed experience and give feedback.

> **Scope of this preview.** It does not assess or tailor your own documents.
> File upload is not available yet. Please use the example materials only.

## What you can explore

1. **Landing** — what RoleFit is and what this preview offers.
2. **Choose an example** — three prepared scenarios (transferable experience,
   strong match, meaningful gaps), each pairing a fictional CV with a job
   description.
3. **Structured role-match assessment** — strengths, transferable evidence and
   gaps for the chosen example, with an illustrative 1–10 indicator. The score
   is hand-authored for each example, is not a formula, and is not a prediction
   of interview or hiring outcomes.
4. **Recommended CV edits** — before/after wording with an explanation for each
   edit. Edits only reorder or rephrase what is already in the example CV;
   nothing is invented. You accept or reject each edit.
5. **Download an example CV** — a `.docx` built in the browser that reflects
   exactly the edits you accepted. Nothing accepted means the original wording.
6. **Optional feedback** — three multiple-choice questions and a personal
   snapshot of your own answers. Answers are held in the page's temporary state
   only and are not stored or sent anywhere by this app.

All example people, employers and figures are fictional. One example
deliberately includes mock personal data to demonstrate a privacy warning step.

## Tech stack

React 18 + TypeScript + Vite front end, with a small Express backend that
`npm run dev` also starts. The preview itself runs client-side on bundled
example data. The backend contains upload parsing and a PII guard intended for a
future live version; the preview UI does not expose upload.

## Running locally

Prerequisites: Node.js (with `npm`).

```bash
npm install
npm run dev
```

`npm run dev` starts two processes concurrently:

- the Vite front end over HTTPS at `https://localhost:5173`, and
- the Express backend over HTTPS at `https://localhost:3001` (plain HTTP on
  `3080` is redirected to HTTPS).

Open `https://localhost:5173`. Your browser will warn that the connection is
not private because the dev server uses a locally generated, self-signed
certificate. For `localhost` it is safe to continue (Chrome/Edge: Advanced →
Proceed to localhost).

On Windows PowerShell, if `npm` is blocked by the execution policy, run
`npm.cmd run dev` instead.

Useful scripts:

- `npm test` — run the test suite (`vitest run --config vitest.config.ts`).
- `npm run build` — production build of the front end.
- `npm run audit` — dependency vulnerability check (`npm audit`).

Some backend property-based tests are heavy and can time out on a loaded
machine. The front-end tests (`web/src`) run quickly.

## Certificates

- The dev server (Vite) uses `vite-plugin-mkcert`, which usually generates and
  trusts its certificate automatically.
- The Express backend uses a self-signed certificate generated on first run into
  the gitignored `certs/` folder. The front end reaches the backend through the
  Vite proxy, so you normally do not need to trust it. If you open
  `https://localhost:3001` directly, you may need to trust it manually.
- Firefox keeps its own certificate store, so a locally trusted certificate may
  need to be trusted separately in Firefox.

## Browser support

Current Chrome, Microsoft Edge (Chromium), Firefox, Safari 16+ and other
Chromium-based browsers. Internet Explorer is not supported.

## Design references

The images in `web/public/` (landing, chooser and dashboard mock-ups and the app
icon) are design references used while building the preview.

## Licence

No licence is granted. The code is published for viewing; all rights are
reserved unless a licence is added later.
