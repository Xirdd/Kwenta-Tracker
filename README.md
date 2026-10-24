# Kwenta — Budget Ledger

A ₱-first income & expense tracker (PWA) with bills, savings goals, utang
(loans), household sharing, and optional 2FA. Vanilla JS + Vite, backed by
Supabase, deployed on Vercel. Built mobile-first for iPhone Safari.

## Getting started

```bash
npm install
npm run dev       # local dev server with hot reload
npm run build     # production build into dist/
npm run preview   # preview the production build
```

Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` (Supabase → Settings → API). Optional:
`VITE_VAPID_PUBLIC_KEY` for push notifications. Vite only reads `.env` at
startup — restart `npm run dev` after changing it. On Vercel, add the same
variables under Project → Settings → Environment Variables.

**An account is required.** There is no guest mode: signed-out visitors only see
the login/sign-up page.

## Project structure

```
kwenta/
├── index.html                shell page: #app, #scrim, #sheet mount points, splash
├── vite.config.js            Vite + PWA (injectManifest, share target)
├── vercel.json               security headers + Content-Security-Policy
├── supabase/
│   ├── migrations/           ← all database changes live here (see "Database")
│   ├── legacy-sql/           archived pre-migration scripts — history only
│   └── functions/
│       ├── delete-account/   deletes the caller's data AND auth user
│       └── send-push/        web-push delivery, called by pg_net
└── src/
    ├── main.js               entry: auth gate, render loop, event wiring
    ├── state.js              DATA store, period state, totals, trend math
    ├── storage.js            localStorage cache (offline copy)
    ├── sync.js               all Supabase reads/writes (errors thrown, retry-queued)
    ├── syncQueue.js          offline retry queue for failed writes
    ├── realtime.js           household live updates (Supabase Realtime)
    ├── auth.js / authGuard.js  sessions, password flows, the render gate
    ├── mfa.js                TOTP 2FA + recovery codes
    ├── appLock.js            device PIN / Face ID lock
    ├── household.js          create/join/leave, invite codes, members
    ├── money.js              whole-centavo arithmetic helpers
    ├── format.js / currency.js  display formatting, currency choice
    ├── categories.js, customCategories*.js, budgetView.js, budgetLimitsCloud.js
    ├── icons/categoryIcons.js  icon library (incl. e-wallet & bank monograms)
    ├── wallets.js, walletLogos.js  wallet balances/transfers; optional official logos
    ├── recurring.js, bills.js, goals.js, loans.js
    ├── backup.js, backupCrypto.js   full backup/restore (optionally encrypted)
    ├── export.js (CSV), pdfExport.js (statement; jsPDF is lazy-loaded)
    ├── push.js, sw.js, shareStore.js, shareParse.js
    ├── notices.js (+ .css)   offline/unsynced banner + "update available" prompt
    ├── insights.js, theme.js, themes.css, glass.css, periodMode.js, toast.js, undo.js
    └── components/           one file per screen / sheet (…Tab.js, …Sheet.js)
```

Naming convention: logic lives at the top of `src/`; UI lives in
`src/components/` with a `Tab` or `Sheet` suffix.

## How data flows

- `state.js` holds the single source of truth: `DATA` (salary, transactions,
  budgets, …) and `state` (which period/tab is active).
- Every component exports a `render*()` that returns an HTML string; only its
  own `attach*Events()` touches the DOM. `main.js` assembles and re-renders.
- Signed in (always, now): `sync.js` reads/writes Supabase at each mutation;
  `localStorage` is kept as an offline cache.
- **Any HTML built from user-controlled text must go through `escapeHtml()`.**
  Custom category names can come from other household members.

## Money

Amounts are stored as peso numbers (matching Supabase `numeric` columns), but
every **total** is computed in whole centavos via `money.js` (`sumPesos`,
`addPesos`, `subPesos`) so floating-point drift can't accumulate. Use those
helpers for any new sum.

Display goes through `fmt()` (`format.js`), which follows the currency chosen in
Profile (symbol, grouping, decimals). It is **display only — nothing is
converted between currencies.** Use `currencySymbol()` instead of a literal "₱".
The PDF statement writes currency codes ("PHP 1,234.00") because jsPDF's
built-in fonts can't draw "₱".

## Look & feel: "lit glass" (`src/glass.css`)

Every card, sheet, nav bar and button is glass. `glass.css` restyles those
surfaces without touching layout:

- **Aurora** — a fixed, static layer (`body::before`) of soft accent/blue/violet
  glows behind the page, so the glass has something to refract. It's static on
  purpose: blurring a moving layer is slow on iPhones.
- **Thickness cues** — each surface gets a bright top edge, a faint left edge
  and a dark bottom edge (`--glass-edge`), plus a diagonal sheen in
  `--gradient-card`.
- **Hierarchy** — cards are lightly frosted, sheets/nav/toasts are the thickest
  (they carry text), and the Net Balance hero gets an accent rim, a colored glow
  and a gradient figure.
- **Themes** — surfaces derive from `--paper` and `--ink`; the glow comes from
  per-theme `--aurora-1..3` tokens at the top of `glass.css`. (It can't come from
  the accent alone — that made every theme glow the same color.)
- **Accent per theme** — `themes.css` sets `--gold` / `--gold-soft` for each
  theme (Forest green, Deep Sea sky blue, Plum lavender, Wine amber, Amoled
  green). `--green` (money in) and `--coral` (money out) never change, so never
  pick an accent close to coral. Keep accents bright: dark text sits on them.
- **Reduce glass effects** — Settings → Appearance. Sets `data-glass="lite"` on
  `<html>` (`theme.js`, per device, key `kwenta_glass`), which removes
  `backdrop-filter` from cards and lightens it on the nav and sheets. Use it for
  older iPhones.
- **Fallbacks** — solid surfaces when `backdrop-filter` is missing, and when the
  OS "Reduce transparency" setting is on.

`glass.css` is imported from `theme.js` right after `themes.css`, which puts it
**last** in the bundle so it wins at equal specificity. Keep it last. To go back
to the old look, remove that one import.

## E-wallet & bank icons

The icon picker's first group, **E-wallets & banks**, has monograms for GCash,
Maya, GoTyme and MariBank, plus generic wallet, bank, QR Ph and cash icons.
They are original line icons in the app's stroke style, **not** the companies'
official logos (trademarked artwork that a one-color icon couldn't reproduce).
When creating a new custom category, **Quick start** chips fill in the name,
icon and a nearby palette color in one tap; everything stays editable. To use an
official logo, you'd need the brand's own asset and permission to use it.

## Wallets (GCash, Maya, GoTyme, Maribank, bank, cash)

The **Wallets** tab tracks "what's actually in it" per wallet: starting balance
plus every transaction tagged to it (goal and utang payments included, because
that money really moved), with transfers between wallets. Icons are the
original monograms from `icons/categoryIcons.js`, not official logos.

- **Tagging:** the Wallet dropdown (`components/walletField.js`) appears on the
  expense/income form and on bill payments (which pre-selects the wallet you
  paid that bill from last time). Recurring entries carry their wallet too
  (`kwenta_recurring.wallet_id`).
- **Private or shared:** inside a household a wallet is shared by default; the
  owner can switch it to private. A private wallet is saved with
  `household_id = null`, so only its owner can see it (row-level security
  already allows that). Entries you tag to it still show for the household,
  just without the wallet name. Joining a household shares your existing wallets
  (as with everything else you own).
- **Filtering:** Expenses has a Wallet dropdown (All / a wallet / No wallet).
  A wallet's detail sheet shows money in/out for the period on screen, its full
  history ("Show all"), transfers marked with ⇄, and **See expenses**, which
  opens Expenses filtered to that wallet. Transfers are separately tracked, so
  they never appear in Expenses or Net Balance.
- **Official logos (optional):** none ship with the app. Add `gcash.svg`,
  `maya.svg`, `gotyme.svg`, `maribank.svg` (or `.png`) to
  `src/assets/wallet-logos/` and they replace the monograms (`walletLogos.js`,
  bundled at build time; a missing file keeps the monogram). Use each company's
  official brand assets and follow their terms — see that folder's README.
- **Adding a provider** touches: `WALLET_PROVIDERS` in `wallets.js`, its icon in
  `categoryIcons.js`, and the `provider` CHECK constraint (a new migration).

## Cloud sync and the offline retry queue

`supabase-js` does **not** throw on a failed request — it resolves with
`{ error }`. Every write in `sync.js` checks that and throws, so callers'
`.catch(notifySyncError)` fires and nothing falsely looks saved.

On a _transient_ failure (offline, timeout, 5xx) the write is also queued in
`localStorage` (`syncQueue.js`) and retried when the browser comes back online
and every 30 s. Permanent failures (permission denied, constraint violations)
are surfaced but not queued, since retrying can't fix them. The queue covers
transactions, salary, budgets, recurring rules, bills, goals, loans, custom
categories and second-half budget limits. It is **wiped on logout / account
change** so one person's unsynced edits can never replay into another account.

## Restore

Restoring a backup calls the `restore_my_data` SQL function, which deletes and
re-inserts everything in **one transaction** — it fully applies or changes
nothing. The app only replaces its in-memory/local copy after the server
succeeds. Backups can be password-encrypted (AES-GCM, PBKDF2); there is no
recovery for a forgotten backup password.

## Recurring entries

An active rule creates its transaction for a period when you view it — but
**never for a period that hasn't started yet**, so browsing ahead writes nothing.
Past and current periods catch up as usual.

## Budget periods

Profile → Budget period: **Semi-monthly** (1st–15th / 16th–end, default) or
**Monthly**. Period keys are `YYYY-MM-H` or `YYYY-MM`; the shape of a key, not
the current setting, decides how it's read, so old data keeps its meaning when
you switch. Bills and Goals are always monthly.

## Security model

Defense in depth — each layer assumes the one above can be bypassed:

1. **Auth gate** (`authGuard.js`): nothing protected is rendered unless the
   session is fully unlocked (including any 2FA challenge).
2. **Row Level Security** on every table. A **restrictive policy**
   (`kwenta_require_mfa`) additionally requires an `aal2` session for any
   account with a verified 2FA factor, so 2FA is enforced by the _database_, not
   just the UI. Recovery-code functions are deliberately left open so a lost
   authenticator can still be recovered.
3. **Password confirmation** (`reauthSheet.js`) for deleting the account,
   disabling 2FA, changing the password, turning off App Lock. It calls
   `verify_my_password` on the server (throttled to 5 wrong tries / 15 min) and
   never touches the session — a browser re-sign-in would downgrade a 2FA
   session. There is **no magic-link bypass**; an account without a password
   uses "Forgot password?" to create one.
4. **App Lock** (`appLock.js`): on creation you choose a **4-digit PIN**, a
   **6-digit PIN** or a **password** (6–64 characters). A PIN unlocks the moment
   its own last digit is typed — never earlier; a password is typed and
   submitted with Unlock. (PINs made before types existed keep working and
   unlock with an Unlock button until they're changed.) Stored as a PBKDF2
   hash, growing delays after 5 wrong attempts, forced sign-out at 10, and
   "Forgot PIN?" needs the account password. It is a client-side convenience
   lock, not a security boundary.
5. **XSS**: custom category names are escaped wherever drawn; ids/colors are
   validated in `categories.js` and by database CHECK constraints.
6. **CSP / headers** in `vercel.json`.

### Households

Shared: transactions, budgets, recurring, bills, goals, utang, custom
categories. **Salary is never shared** (no `household_id` column).

- Invite codes are 10 characters and **expire after 7 days**. Wrong and expired
  codes look identical. Joining is rate-limited (5 attempts / 15 min).
- **Creating or joining asks first** (`householdSheet.js`): it lists what's
  about to be shared (transactions, recurring entries, bills, goals, utang,
  wallets, budget limits) and offers "without sharing". Not sharing leaves your
  existing entries personal — hidden while you're in the household, back if you
  leave — but personal wallets stay visible, so their balances won't include
  those hidden entries until you leave. Nothing to share = no question asked.
- The **owner** (creator) can regenerate the code and remove members; everyone
  can see the member list. Removed members lose access; entries they added stay.
- Leaving only deletes your membership.
- Realtime keeps members in sync; every shared table must be in the
  `supabase_realtime` publication with `replica identity full`.
- Every change is logged to `kwenta_household_activity` by database triggers.

### Delete account

Profile → Delete my account (password confirmation, then type `DELETE`) calls
the **`delete-account` Edge Function**, which verifies the user, requires 2FA if
enabled, runs `delete_my_account_data()` as the user, then deletes the
`auth.users` row with the service-role key (which only ever exists server-side).
A household survives its creator leaving (`created_by` is `ON DELETE SET NULL`).

### Manual Supabase dashboard settings (not in code)

- Auth → Email: minimum password length **8**.
- Auth → Attack Protection: **leaked-password protection**. CAPTCHA too — but
  turning it on requires the login forms to send a captcha token first.
- `kwenta_household_members` must have **no INSERT policy** for `authenticated`
  (joining must go through `join_household_by_code`).

## Database & migrations

All schema changes are **migrations** in `supabase/migrations/`, applied with the
Supabase CLI (`npx supabase`, no global install needed). Never paste ad-hoc SQL
into the dashboard for something you want to keep.

```bash
npm run db:new -- add_something   # new timestamped file in supabase/migrations/
# write idempotent SQL in it, commit it, then:
npm run db:push                   # applies migrations the remote hasn't seen
npm run db:list                   # local vs remote migration status
```

**One-time baseline** (the database predates migrations): with Docker Desktop
running and the project linked (`npx supabase link --project-ref <ref>`), run
`npm run db:pull` — it writes `supabase/migrations/<timestamp>_remote_schema.sql`
capturing the live schema. Run it **before** adding new migrations, and make
sure any new migration's timestamp sorts _after_ the baseline's. Old hand-run
scripts are archived in `supabase/legacy-sql/` and are history only.

`pg_cron` job schedules (push reminders, activity-log pruning) are data, not
schema, so `db pull` does not capture them — keep their `cron.schedule` calls in
a migration of their own.

Edge Functions deploy separately:
`npx supabase functions deploy delete-account` (JWT verification ON) and
`npx supabase functions deploy send-push --no-verify-jwt` (called by Postgres,
protected by a shared secret — see the header of its `index.ts`).

## Performance

`jsPDF` is loaded with a dynamic `import()` the first time someone taps
**Statement**, so it's a separate chunk instead of part of every page load.
(The service worker still precaches it after install so the statement works
offline.) The glass look uses `backdrop-filter`, which is the costly part on
older iPhones — that's why the aurora is static and blur radii are capped, and
why Settings → Appearance has a Reduce glass effects switch.

## Accessibility

Every dialog goes through `src/components/modal.js`, which provides the
behaviour once for all of them: `role="dialog"` + `aria-modal`, labelled by the
dialog heading; **Escape** closes it (using the same handler as tapping outside,
so non-dismissible dialogs — the 2FA code prompt, recovery codes — stay
non-dismissible); **Tab / Shift+Tab are trapped** inside; the page behind is
`inert`; focus moves into the dialog on open and back to the opener on close;
and a closed sheet is `inert` so its leftover controls can't be tabbed to. New
dialogs get all of this for free by using `openModal()`; give them an `<h3>` so
they have an accessible name. Tap targets stay ≥ 44×44 px. Glass surfaces fall
back to opaque when the OS "Reduce transparency" setting is on.

## Notices: offline, unsynced, update available

`src/notices.js` shows two banners at the top of the screen:

- **Offline / unsynced** — "You're offline…" with no connection, and
  "N changes waiting to sync" whenever the retry queue still holds anything.
- **Update available** — the service worker is registered with
  `registerType: "prompt"`, so a new version downloads in the background but
  _waits_; tapping **Update** posts `SKIP_WAITING` (handled in `src/sw.js`) and
  reloads. This avoids a new worker swapping in under a page still running old
  code. The app also checks for a new version hourly while it stays open.

The service worker only exists in production builds, so the update banner never
appears under `npm run dev`.

**Layout:** the banners are one solid bar pinned to the top of the screen. Its
background runs under the iPhone status bar / notch / Dynamic Island
(`padding-top: env(safe-area-inset-top)`), its text sits below that, and
`notices.js` publishes the bar's height as `--notice-h` so the page content is
pushed down by exactly that much rather than being covered.

## First-run walkthrough

`components/onboardingSheet.js` shows a 4-step tour once per account per device,
only for accounts that look brand new (no transactions, bills, goals, loans or
salary). It's marked as seen the moment it's shown, so a reload never repeats it.
It never opens on top of a shared-item intake or the set-password prompt.

## Zoom lock (native-app feel)

Double-tap and pinch zoom are disabled so the PWA behaves like a native app:
`maximum-scale=1, user-scalable=no` in the viewport tag (`index.html`),
`touch-action: manipulation` on the roots (`mobile.css`), and iOS `gesture*`
event cancelling plus a double-tap guard for non-interactive areas
(`mobileShell.js`). Text is also non-selectable except in inputs and the few
things people copy by hand (invite code, recovery codes, 2FA secret). Note this
removes pinch-to-zoom as an accessibility aid; if low-vision users matter,
add an in-app text-size setting instead of re-enabling zoom.

## Bills, Goals, Utang

- **Bills** are templates (name, category, due day, estimated amount) — nothing
  is auto-logged. Tapping one and entering what you paid creates the real
  expense, linked via `billId`. Undo deletes it.
- **Goals** are a target (and optional target month). Contributions are real
  `savings` expenses linked via `goalId`; progress sums all months.
- **Utang** records a person, direction (`lent` / `borrowed`, fixed once
  created), amount and date. Principal and repayments are real transactions
  linked via `loanId`. Remaining = amount − repayments.
- Goal and utang transactions are **excluded from Net Balance, totals, trends
  and the Expenses list** (`isSeparatelyTracked` in `state.js`) — they appear in
  their own tabs. `monthTx(type, { excludeSeparatelyTracked: false })` gives the
  unfiltered view.

## Other features

- **Custom budget categories** with icon, color and optional limit; the Budgets
  tab shows a customizable subset (per-device, `budgetView.js`). New categories
  can start from a GCash / Maya / GoTyme / MariBank / Cash quick-start chip.
- **Tags** on expenses/income; search matches description, category and tags.
  A global search sheet covers everything.
- **Insights** tiles on Overview (biggest swing, savings rate, over-budget…).
- **Themes**: five dark themes (Forest, Deep Sea, Plum, Wine, Amoled) — each
  sets its own background tones and accent; the income-green and expense-coral
  meaning colors never change.
- **Exports**: CSV, a designed PDF statement, and full JSON backup.
- **Push notifications** (bill due, budget exceeded) via `pg_cron` → `pg_net` →
  `send-push`. On iPhone, install to the Home Screen first (iOS 16.4+).
- **PWA**: `vite-plugin-pwa` (injectManifest) precaches the app shell; Supabase
  calls are never cached. Android can share a receipt/text into Kwenta
  (`shareStore.js`); iOS doesn't support receiving shares.
- **Devices** list and "sign out other devices" under Profile.

## Editing tips

- **Add a category:** edit `src/categories.js`. IDs never change, only labels.
- **Add an icon:** add `{ id, label, paths }` to a group in
  `src/icons/categoryIcons.js` (24×24, stroke-based). Only the id is stored.
- **Add a quick-start chip:** add to `PRESETS` in
  `src/components/categoryFormSheet.js`; use a color from
  `CUSTOM_CATEGORY_COLORS` so its swatch highlights.
- **Colors/fonts:** `:root` tokens at the top of `src/style.css`; theme
  backgrounds and accents in `src/themes.css`; glass look and per-theme aurora
  in `src/glass.css`. A new theme needs entries in `themes.css`, `glass.css`
  (`--aurora-*`), `THEMES` in `theme.js` and the id list in `index.html`.
- **Add a database column/table:** `npm run db:new`, never the dashboard.
- **Add a table that household members share:** add it to `SHARED_TABLES` in
  `realtime.js`, to the realtime publication, set `replica identity full`, add
  a `kwenta_require_mfa` restrictive policy, and add it to `restore_my_data`.

## Known limitations

- No conflict resolution: two people editing the same entry within ~800 ms →
  last write wins.
- Amounts are stored as peso numbers; only arithmetic is centavo-exact.
- The sync queue stores plain JSON in `localStorage`; it's cleared on logout.
- Currency and period mode are per-device settings.
- The e-wallet icons are monograms unless you add official logo files (see Wallets).
