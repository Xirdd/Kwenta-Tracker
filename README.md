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
    ├── theme.js               light/dark mode toggle + persistence
    ├── supabaseClient.js      Supabase client (reads .env)
    ├── auth.js                sign in / sign up / sign out / session state
    ├── sync.js                loads & writes salary, transactions, budgets to Supabase
    └── components/
        ├── header.js          app title, account button, theme toggle, export button
        ├── monthNav.js        month back/forward control
        ├── ledgerCard.js      balance summary card
        ├── tabs.js            Overview / Income / Expenses / Budgets tab bar
        ├── overview.js        donut chart, category breakdown, 6-month trend
        ├── income.js          monthly salary field + extra income list
        ├── expenses.js        expense list
        ├── budgets.js         per-category monthly budgets + progress bars
        ├── sheet.js           add / edit / delete bottom sheet (or modal on desktop)
        ├── modal.js           shared open/close logic used by sheet.js and authSheet.js
        ├── authSheet.js       sign in / sign up form (password optional, magic link)
        └── accountSheet.js    signed-in account view + sign out
```

## How data flows

- `state.js` holds the single source of truth: `DATA` (salary, transactions, budgets) and `state` (which month/tab is active).
- Every component module exports a `render*()` function that returns an HTML string — no component talks to the DOM directly except for its own `attach*Events()` function (used where a full re-render would lose input focus, like the salary field and budget inputs).
- `main.js` is the only place that assembles the full page and re-renders it after any change.
- `sheet.js` is initialized with a callback (`initSheet(render)`) so it can trigger a re-render after saving or deleting an entry, without importing `main.js` directly.
- **Signed out:** data lives in `localStorage` (`storage.js`), exactly as before.
- **Signed in:** `sync.js` reads/writes Supabase directly at each mutation point (salary input, budget input, add/edit/delete transaction). `localStorage` still gets updated too, as an offline cache.
- On sign-in, if the cloud account has no data yet, whatever is saved locally on that device is pushed up automatically (`cloudMigrateLocalDataIfEmpty`). If the account already has cloud data, the cloud data wins and is loaded instead.

## Setting up Supabase (for sign in + cloud sync)

1. Create a new project at [supabase.com](https://supabase.com) (you chose a separate project from Hobbits).
2. In the Supabase dashboard, go to **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it. This creates the three tables (`kwenta_salary`, `kwenta_transactions`, `kwenta_budgets`) with Row Level Security so each user can only see their own rows.
3. Go to **Settings → API** and copy the **Project URL** and **anon public key**.
4. Copy `.env.example` to `.env` in the project root, and fill in those two values:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
5. Restart `npm run dev` if it was already running (Vite only reads `.env` on startup).
6. By default, Supabase requires email confirmation for password sign-ups. For local testing you can turn this off under **Authentication → Providers → Email → Confirm email**, or just use the magic link option, which doesn't need confirmation.
7. When you deploy to Vercel, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Environment Variables in the Vercel project settings (same idea as any `.env` value) — otherwise sign-in will silently stay disabled in production.

Without a `.env` file, the app still works exactly as before — it just stays in local-only guest mode and the account button opens a sign-in form that shows a "Supabase is not configured" message.

## Editing tips

- **Add a category:** edit `src/categories.js` — one array entry, done.
- **Change colors/fonts/spacing:** edit the `:root` variables at the top of `src/style.css`. The ledger "paper" (cards, text, category colors) looks the same in both themes on purpose — only the desk behind it changes. Theme-specific overrides live in the `[data-theme="light"]` block right below `:root`.
- **Add a new tab:** create a new file in `src/components/`, add it to `TAB_LIST` in `tabs.js`, and wire it into the switch in `main.js`.
- **Swap storage:** everything persistence-related lives in `storage.js`. To move to Supabase or Dexie (like the Hobbits app), you only need to change `loadData()`/`persist()` there — nothing else touches storage directly.

## Notes

- Data is currently stored in the browser's `localStorage`, scoped to whichever device/browser you're using. There's no cross-device sync yet.
- Deploys the same way as a typical Vite app — e.g. connect this folder to Vercel like the Hobbits project.
