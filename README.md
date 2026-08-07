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
    ├── sync.js                loads & writes salary, transactions, budgets, recurring rules to Supabase
    ├── recurring.js           recurring rule create/stop + monthly materialization
    ├── bills.js               bill create/edit/delete, mark paid/undo, due-date math
    ├── goals.js               goal create/edit/delete, contribute/undo, progress + pace math
    ├── loans.js               utang create/edit/delete, record/undo repayments, running balances
    ├── household.js           create/join/leave a household, active household state, data migration
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

`src/components/billsTab.js` (the Bills tab) and `src/components/billSheet.js` (add/edit a bill, mark paid, undo payment) sit alongside the files above. `src/components/goalsTab.js`/`goalSheet.js` and `src/components/loansTab.js`/`loanSheet.js` follow the same pattern for goals and utang respectively. `src/components/householdSheet.js` (create/join/leave a household) follows the `Sheet` naming convention too, even though there's no matching `householdTab.js` — household management lives inside the account sheet, not its own tab. Note the naming convention overall: logic files live at the top of `src/` (`bills.js`, `goals.js`, `loans.js`, `household.js`), UI files live in `src/components/` with a `Tab`/`Sheet` suffix (`billsTab.js`, `goalsTab.js`, `loansTab.js`, `householdSheet.js`) — they're never named identically, so there's no ambiguity about which one you're looking at.

## How data flows

- `state.js` holds the single source of truth: `DATA` (salary, transactions, budgets) and `state` (which month/tab is active).
- Every component module exports a `render*()` function that returns an HTML string — no component talks to the DOM directly except for its own `attach*Events()` function (used where a full re-render would lose input focus, like the salary field and budget inputs).
- `main.js` is the only place that assembles the full page and re-renders it after any change.
- `sheet.js` is initialized with a callback (`initSheet(render)`) so it can trigger a re-render after saving or deleting an entry, without importing `main.js` directly.
- **Signed out:** data lives in `localStorage` (`storage.js`), exactly as before.
- **Signed in:** `sync.js` reads/writes Supabase directly at each mutation point (salary input, budget input, add/edit/delete transaction, recurring rules). `localStorage` still gets updated too, as an offline cache.

## Recurring transactions

- Checking "Repeats every month" on an expense or income entry creates a **recurring rule** (`DATA.recurring`) — a template with a category, amount, and day-of-month, separate from the actual transaction rows.
- Every time the viewed month changes (`main.js` calls `materializeMonth(monthKey)`), each active rule gets checked: if that month doesn't have a matching transaction yet, one is created automatically and linked back to the rule via `recurringId`.
- Editing a recurring-linked entry and saving updates the _rule_ (so future months use the new amount/category too), while editing without touching the checkbox only changes that one occurrence.
- Deleting a recurring-linked entry also stops the rule — it won't generate future months. Past occurrences already created stay in your history untouched.
- There's no "skip just this one month, keep future months" option yet — deleting always stops the whole series. If you need that, it's a reasonable follow-up feature.
- On sign-in, if the cloud account has no data yet, whatever is saved locally on that device is pushed up automatically (`cloudMigrateLocalDataIfEmpty`). If the account already has cloud data, the cloud data wins and is loaded instead.

## Bills (due-date reminders)

Bills are deliberately **not** the same mechanism as recurring transactions — utility bills (Meralco, water, internet) vary in amount every month, so auto-creating a transaction with a guessed amount would just mean editing it later anyway. Instead:

- A bill (`DATA.bills`, table `kwenta_bills`) is just a template: name, category, day-of-month it's due, and an optional estimated amount.
- The **Add Bill** form has its own category picker (`BILL_CATEGORIES` in `categories.js`) — Electricity, Water, WiFi & Internet, Gadget Installment, and Others — separate from the general expense category grid, even though they're the same underlying categories under the hood (so budgets and the Overview breakdown still work normally for them).
- Choosing **Others** reveals a free-text field for a custom label (e.g. "Condo dues"), stored as `bill.customCategory`. Anywhere a bill's category is displayed, the custom label is shown instead of the generic "Others" when one was entered (`billCategoryLabel()` in `bills.js`). The linked expense transaction itself still uses the `other` category id, so it stays consistent with the rest of the app's fixed category system.
- Nothing gets logged automatically. The **Bills** tab and the **Overview** tab's "Upcoming bills" widget (bills due within 7 days, or overdue) just show a due-date badge.
- Tapping a bill opens a "Mark as paid" sheet — enter what you actually paid, and _that_ creates the real expense transaction, linked back to the bill via `billId`. The Overview widget only appears when there's something due soon, so it stays out of the way otherwise.
- Tapping an already-paid bill shows what was paid and when, with an "Undo payment" option that deletes that transaction.
- The due-date badge (`Due in Xd` / `Due today` / `Xd overdue`) is only meaningful when viewing the real current month — browsing past/future months just shows "Not paid" instead, since "3 days" doesn't mean anything for a month that isn't the current one.

## Goals (savings targets)

- A goal (`DATA.goals`, table `kwenta_goals`) is a name, a target amount, and an optional target month (e.g. "₱20,000 by December").
- "Adding money" to a goal creates a real expense transaction in the `savings` category, linked back to the goal via `goalId` — so contributions count toward your monthly totals and any budget you've set on the Savings category, same as any other expense. Nothing about goals is a separate, hidden ledger.
- Progress (`saved / target`) is calculated by summing every transaction linked to that goal, across all months — not just the currently viewed one, since goals accumulate over time.
- If a target month is set and the goal isn't finished yet, a pace hint shows roughly how much to save per month to hit it on time (`paceHint()` in `goals.js`). No hint shows once the goal is reached, or if no target month was set.
- Undoing a contribution just deletes that transaction; the goal definition itself is untouched.

## Utang (loan tracker)

- A loan (`DATA.loans`, table `kwenta_loans`) records a person, a direction, an amount, a date, and an optional note. Direction is one of `lent` (they owe you) or `borrowed` (you owe them) — it's fixed once created, since flipping it after repayments exist would be ambiguous; delete and re-add if you pick the wrong one.
- Creating a loan immediately logs a real transaction — an **expense** if you lent money (it left your wallet) or **income** if you borrowed it (it came in) — tagged `category: 'utang'` and linked via `loanId` with `loanKind: 'principal'`. This is the same principle as bills and goals: the cash movement is real, not a side-ledger.
- Recording a payment logs the opposite transaction type, linked via the same `loanId` with `loanKind: 'repayment'` — income when someone pays you back, expense when you pay someone back.
- The remaining balance (`remainingAmount()` in `loans.js`) is just `amount - sum of repayments`, calculated across all time. Once it hits zero, the loan shows as "Settled."
- The **Utang** tab shows a summary of total owed-to-you vs you-owe at the top, then each person as its own card with a repayment progress bar.
- Undoing a repayment just deletes that transaction; deleting the loan itself removes it from the tracker but leaves its historical transactions in place (consistent with how deleting a recurring rule or bill works).

## Expense search & filter

- The Expenses tab has a search box (matches against description and category label) and a row of category filter chips — only categories actually used that month show up as chips, to keep the row relevant.
- Filters live in `state.expenseFilters` (not persisted to storage) and reset automatically when you change months, so a filter from a previous month doesn't silently hide everything in the next one.
- Typing in the search box only re-renders the list itself (`#expenseListWrap`), not the whole tab, so the input never loses focus mid-keystroke. Clicking a category chip re-renders the whole section instead, since the chip's own active state needs to update too.

## Households (shared budgets between multiple people)

This is the biggest architectural feature in the app, so it's documented in more depth than the others.

**What's shared vs. private:** Once you're in a household, **transactions, budgets, recurring rules, bills, goals, and utang** are visible and editable by every member — regardless of who originally logged them. **Salary (`kwenta_salary`) is never shared, under any circumstances** — it has no `household_id` column at all, by design, not just by app logic.

**Joining a household:** no email required, on purpose (Supabase's default mailer is rate-limited, as you've already run into). Instead:

- `create_household(name)` — a Postgres function — creates a household, generates a random 6-character invite code, and adds you as the first member, all in one atomic step.
- `join_household_by_code(code)` looks up a household by that code and adds you as a member. Both are `security definer` functions, so they can do their job without needing broad table-level `SELECT`/`INSERT` access that would otherwise leak other households' data.
- The invite code is just a code — share it however you want (text message, Messenger, in person). Whoever has it can join.

**How sharing actually works:** every shareable table (`kwenta_transactions`, `kwenta_recurring`, `kwenta_bills`, `kwenta_goals`, `kwenta_loans`, and `kwenta_budgets`) has a nullable `household_id` column.

- `household_id = null` → personal, only visible to the row's owner (`user_id`) — the exact same behavior as before households existed.
- `household_id = <id>` → visible and editable by every member of that household, via the `is_household_member()` helper function used in each table's RLS policy.
- `src/sync.js`'s `cloudLoadAll()` picks one scope or the other based on `getActiveHouseholdId()` (from `src/household.js`) — either "rows I own with no household" or "rows tagged with my active household" — never both mixed together.

**Budgets are a special case.** Every other shareable table already has a unique client-generated `id`, so adding `household_id` as a plain column was enough. Budgets didn't have that — the primary key was `(user_id, category)` — and changing a live table's primary key felt like unnecessary risk for a personal project's database. Instead, `cloudUpsertBudget()` in `sync.js` manually checks whether a household already has a row for that category and updates it, or inserts a fresh one — deduplication lives in application code instead of a database constraint.

**Migrating existing data:** when you create or join a household, `migratePersonalDataToHousehold()` (in `household.js`) re-tags your existing personal rows with the new `household_id` — for budgets specifically, only for categories the household doesn't already have a value for, so joining an existing household never silently overwrites what's already there.

**Leaving a household:** just deletes your membership row. Data you shared stays with the household (other members still see it) — you simply lose visibility into it, since your queries go back to "rows I own with no household." This is called out directly in the leave-confirmation dialog so it's never a surprise.

**Known limitation:** there's no real-time sync. If another household member adds an expense right now, you won't see it appear automatically — it'll be there next time you reload the page, change tabs, or navigate months (anything that triggers a fresh `cloudLoadAll()`). Supabase Realtime could close this gap in a future pass, but it's a meaningfully bigger addition (websocket subscriptions, merge-conflict handling) than anything else in this feature.

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
