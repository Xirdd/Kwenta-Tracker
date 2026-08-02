# Kwenta — Budget Ledger

A ₱-first income & expense tracker, styled like an open ledger book.

## Getting started

```bash
npm install
npm run dev       # local dev server with hot reload
npm run build     # production build into dist/
npm run preview   # preview the production build
```

## Project structure

```
kwenta/
├── index.html               shell page: #app, #scrim, #sheet mount points
├── package.json
├── vite.config.js
└── src/
    ├── main.js               entry point — render loop + event wiring
    ├── style.css              all styles (design tokens as CSS variables at the top)
    ├── state.js               DATA store, current month/tab state, totals, trend math
    ├── storage.js             localStorage persistence (swap out for Supabase/Dexie later)
    ├── categories.js          expense & income category lists
    ├── format.js              currency/date formatting, csv escaping, id generation
    ├── export.js              CSV export
    └── components/
        ├── header.js          app title + export button
        ├── monthNav.js        month back/forward control
        ├── ledgerCard.js      balance summary card
        ├── tabs.js            Overview / Income / Expenses / Budgets tab bar
        ├── overview.js        donut chart, category breakdown, 6-month trend
        ├── income.js          monthly salary field + extra income list
        ├── expenses.js        expense list
        ├── budgets.js         per-category monthly budgets + progress bars
        └── sheet.js           add / edit / delete bottom sheet (or modal on desktop)
```

## How data flows

- `state.js` holds the single source of truth: `DATA` (salary, transactions, budgets) and `state` (which month/tab is active).
- Every component module exports a `render*()` function that returns an HTML string — no component talks to the DOM directly except for its own `attach*Events()` function (used where a full re-render would lose input focus, like the salary field and budget inputs).
- `main.js` is the only place that assembles the full page and re-renders it after any change.
- `sheet.js` is initialized with a callback (`initSheet(render)`) so it can trigger a re-render after saving or deleting an entry, without importing `main.js` directly.

## Editing tips

- **Add a category:** edit `src/categories.js` — one array entry, done.
- **Change colors/fonts/spacing:** edit the `:root` variables at the top of `src/style.css`.
- **Add a new tab:** create a new file in `src/components/`, add it to `TAB_LIST` in `tabs.js`, and wire it into the switch in `main.js`.
- **Swap storage:** everything persistence-related lives in `storage.js`. To move to Supabase or Dexie (like the Hobbits app), you only need to change `loadData()`/`persist()` there — nothing else touches storage directly.

## Notes

- Data is currently stored in the browser's `localStorage`, scoped to whichever device/browser you're using. There's no cross-device sync yet.
- Deploys the same way as a typical Vite app — e.g. connect this folder to Vercel like the Hobbits project.
