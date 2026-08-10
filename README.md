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
    ├── realtime.js            Supabase Realtime subscription — household members see each other's changes live
    ├── recurring.js           recurring rule create/stop + monthly materialization
    ├── bills.js               bill create/edit/delete, mark paid/undo, due-date math
    ├── goals.js               goal create/edit/delete, contribute/undo, progress + pace math
    ├── loans.js               utang create/edit/delete, record/undo repayments, running balances
    ├── household.js           create/join/leave a household, active household state, data migration
    └── components/
        ├── header.js          app title, household badge, account/profile icon
        ├── monthNav.js        month back/forward control
        ├── ledgerCard.js      balance summary card
        ├── tabs.js            Overview / Income / Expenses / Budgets / Bills sub-tab bar
        ├── bottomNav.js       Overview / Goals / Utang / Profile bottom nav (primary navigation)
        ├── overview.js        donut chart, category breakdown, 6-month trend
        ├── income.js          monthly salary field + extra income list
        ├── expenses.js        expense list
        ├── budgets.js         per-category monthly budgets + progress bars
        ├── profileTab.js      account, household, password, theme, export — all in one place
        ├── sheet.js           add / edit / delete bottom sheet (or modal on desktop)
        ├── modal.js           shared open/close logic used by sheet.js and authSheet.js
        ├── authSheet.js       sign in / sign up form (password optional, magic link)
        └── setPasswordSheet.js  set/change password — auto-prompt after magic-link signup, or manual from Profile
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

## Goals and Utang are tracked separately from your main balance

Goal contributions and utang principal/repayments are still logged as real transactions (nothing is hidden — it's just not double-counted). `isSeparatelyTracked(tx)` (in `state.js`) flags any transaction with a `goalId` or `loanId`, and `monthTx(type)` excludes those by default.

That default is what everything reads from — `totals()` (the Net Balance card), `trendTotals()` (the 6-month trend chart), the Overview "Where it went" breakdown, the Budgets tab's spent totals, and even the Income/Expenses list views all call `monthTx()` with no extra arguments, so they all get the same exclusion automatically. Practically: adding ₱5,000 to a savings goal or lending money to a friend won't move your Net Balance, your expense total, or show up in your Expenses tab — it only shows up in the Goals or Utang tab, which already have their own dedicated summaries (progress rings, owed-to-you/you-owe totals).

If a future feature needs the _unfiltered_ view (all transactions, goal/utang movements included), `monthTx(type, { excludeSeparatelyTracked: false })` is there for that — nothing currently uses it, but the option exists rather than needing a second, parallel function.

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

## Themes

5 total, up from the original Dark/Light — `theme.js` exports a `THEMES` array (id, label, and two preview colors used for the swatch picker) instead of the old binary toggle, so Profile → Appearance renders one circular swatch per theme rather than a single "switch to light/dark" button.

- **Dark** / **Light** — the originals.
- **Midnight** — a cooler, moodier dark theme: indigo-blue instead of navy-green.
- **Sepia** — leans further into the "old ledger book" feel — warm, vintage tones.
- **Slate** — minimal graphite — the most modern, least "vintage" option.

`--gold`, `--green`, and `--coral` are never overridden by any theme — they stay pixel-identical everywhere, since they're semantic (income/positive is always green, expense/negative is always coral, brand accent is always gold) rather than decorative, and changing what "red" means depending on theme would be confusing regardless of how nice it looked. Every theme only touches background/paper/ink-family variables — same pattern the original Light theme already used relative to Dark, just extended to 3 more palettes, with Midnight and Sepia additionally shifting `--paper`/`--ink` (not just background) for more real distinctiveness than a simple background swap.

`initTheme()` still only ever auto-picks between Dark and Light based on system preference for a first-time visitor — there's no meaningful "system preference" for Midnight/Sepia/Slate, so those three are only ever reached by deliberately choosing them in Profile.

## Devices — see where you're signed in

Profile → Devices → **View** (only shown when signed in) lists every active session, via `list_my_sessions()` in `schema.sql` — a security-definer function reading Supabase's internal `auth.sessions` table, scoped to `auth.uid()` so it can only ever return the caller's own sessions.

A couple of honest limitations, both inherent to what Supabase's client SDK actually exposes (not something more code can work around):

- **"Sign out other devices" is all-or-nothing** — there's no way to target one specific other device individually and leave the rest; `supabase.auth.signOut({ scope: 'others' })` is the finest control the client SDK gives without the service-role key, so that's what "Sign out other devices" does — every session except this one, all at once.
- **`auth.sessions` isn't a stable public API** — it's Supabase's internal table, not a documented, versioned interface, so its exact columns can vary slightly across projects/GoTrue versions. `list_my_sessions()` tries to include `user_agent` (for the "Chrome on Windows" style device label) and falls back to just timestamps if that column isn't present, rather than failing outright — but if the underlying table structure changes more significantly in a future Supabase update, this may need a re-check.
- **Which session is "this device"** is determined by decoding the `session_id` claim out of the current access token's JWT payload (`decodeJwtSessionId()` in `auth.js`) — the client's `Session` object doesn't expose a session id as a plain field, so this is what's actually reliable to compare against what `list_my_sessions()` returns.

## Two-factor authentication (2FA)

Uses Supabase's built-in TOTP support (`supabase.auth.mfa.*`) directly — no external QR library needed, since Supabase's enroll response already returns a ready-to-render QR code as SVG.

**Setup** (`mfaSetupSheet.js`, Profile → Two-factor authentication → Manage): enroll a factor, scan the QR with any standard TOTP authenticator app — Google Authenticator, Microsoft Authenticator, Authy, 1Password, iPhone's built-in one (Settings → Passwords), or any other RFC 6238-compliant app — or type in the secret manually. Nothing here is tied to one specific app; Supabase's `mfa.enroll()` returns a standard `otpauth://` QR code, the same format every authenticator app already knows how to read. Enter one code to prove it's actually working before it activates. Disabling later is gated behind [password re-confirmation](#re-confirming-your-password-before-sensitive-changes) — turning off 2FA is itself a sensitive action.

**The part that actually matters — sign-in time** (`mfaChallengeSheet.js`): enrolling a factor alone doesn't do anything by itself; the sign-in flow has to actually check for it and enforce it, or "2FA" is just a setting nobody's account benefits from. After a successful password (or magic-link) sign-in, `requireMfaIfNeeded()` checks whether the account has a verified factor and this particular session hasn't completed it yet (`supabase.auth.mfa.getAuthenticatorAssuranceLevel()` — comparing `currentLevel` against `nextLevel`). If so, a **non-dismissible** code prompt appears — no cancel button, no closing it by clicking outside — the only ways forward are entering a correct code or signing out. Wired into both entry points that complete a sign-in: `authSheet.js` (password) and `main.js` (magic-link landing + returning-session page loads).

Once a session completes the challenge, it stays satisfied for that session (Supabase encodes the assurance level in the session itself) — so this doesn't re-prompt on every page reload, only on an actual new sign-in.

**Recovery codes** (`mfa.js`, `mfaSetupSheet.js`, `mfaChallengeSheet.js`): Supabase's MFA doesn't include backup codes on its own, so this part is fully custom — 8 one-time codes, bcrypt-hashed via Postgres's `pgcrypto` extension the same way a password would be (never stored in plain text), generated the moment 2FA is enabled and shown exactly once. Without this, losing an authenticator app would mean permanent lockout: disabling 2FA needs a fully-signed-in (aal2) session, but there'd be no way to reach aal2 without the authenticator that's now gone — genuinely circular. On the sign-in challenge screen, "Lost your authenticator? Use a recovery code" verifies the code against the stored hash and, on a match, **disables 2FA entirely** rather than trying to fake a session upgrade (a recovery code isn't real TOTP proof, so there's no legitimate way to grant aal2 from it) — same pattern GitHub and Google use. The person is expected to re-enroll once they have a working authenticator again. Profile → Two-factor authentication also shows how many codes are left and offers regenerating the set (itself gated behind password confirmation, same as disabling).

**One assumption worth flagging, since it couldn't be tested against a live Supabase project:** the recovery-code path calls `supabase.auth.mfa.unenroll()` while the session is still at aal1 (that's the whole point — no aal2 available at that moment). This is my best understanding of Supabase's default behavior — removing your own factor shouldn't need proof of a factor you're actively trying to recover from losing — but if a given project's configuration requires aal2 for unenroll, that call would fail. The code handles this by explicitly telling the person their code was accepted but the automatic removal didn't go through, rather than silently pretending it worked — worth testing this specific path end-to-end before relying on it.

**An honest limitation, stated plainly rather than glossed over:** this protects everything that goes through the app's own UI, which covers realistic usage. It does **not** currently extend into the database's RLS policies themselves — a sufficiently sophisticated attacker with just the password, making raw API calls directly to Supabase rather than going through this app, could still authenticate at `aal1` and query data, since none of the RLS policies in `schema.sql` currently check the assurance level. Retrofitting that into every policy across every table is a meaningfully larger, riskier change (and one that needs to be careful not to lock out people who never enroll in 2FA at all, since `aal1` is their natural — and only — level). That's a reasonable next hardening step if this app's threat model ever grows past "protect against a phished or reused password," but it's out of scope for this pass.

## Re-confirming your password before sensitive changes

`reauthSheet.js`'s `requirePasswordConfirmation(onConfirmed, options)` is a reusable gate — call it with a callback, and that callback only fires after the person re-enters their current password and it's verified with a fresh `signInWithPassword()` call. It's currently wired into two flows:

- **Delete account** — always gated. Nothing more destructive in the app, so this one's non-negotiable.
- **Change password (manual context only)** — gated. The automatic prompt right after a magic-link signup is deliberately _not_ gated — that flow already **is** the fresh authentication, so adding another password check there would just be friction with no real benefit. Manually changing an existing password later, potentially from a session that's been open for a while, is the actual risk this protects against: someone with access to an already-open session isn't necessarily the account owner, and without this gate they could quietly lock the real owner out.

**An honest limitation, not a bug:** there's a "I signed up via magic link — I don't have a password" escape hatch on the confirmation sheet, because Supabase's `signInWithPassword` returns the exact same generic error for "wrong password" and "no password set at all" (deliberately — distinguishing them would leak which emails have a password to anyone probing). There's no reliable way to detect "this account has no password" ahead of time and skip the prompt automatically, so the escape hatch just trusts the existing session instead. That's a reasonable tradeoff for a personal-scale app, but worth knowing if this pattern gets reused somewhere the stakes are higher — it isn't a perfect gate, just a meaningfully better one than nothing.

## Delete account

Profile → **Delete my account** (a deliberately understated link below Sign out, not a competing button — this is rare and severe enough that it shouldn't be easy to hit by accident) opens a confirmation sheet that requires typing `DELETE` before the button does anything.

**What it actually does today**, via `delete_my_account_data()` in `schema.sql`: erases every transaction, budget, bill, goal, loan, and recurring rule the person owns, and removes their household membership. This works entirely client-side (no extra deployment needed) because it's a security-definer function scoped to `auth.uid()` — the same pattern used everywhere else in this schema.

**What it doesn't do**: delete the actual sign-in record (`auth.users` row) — that requires the service-role key, which must never exist in browser code. `supabase/functions/delete-account/` has the optional Edge Function for that half, with deploy instructions in the file itself. Deploy it via the Supabase CLI if you want "delete account" to also mean the email/password combo stops working entirely, not just the data behind it. Not wired into the app by default.

**A real bug this fix also closed**: `kwenta_households.created_by` used to be `on delete cascade` — meaning if a household's creator's account was ever deleted (whether through this feature, the optional Edge Function, or just clicking delete in the Supabase dashboard directly), the entire household row would cascade-delete too, and every other member's shared data would vanish with it (everything references `kwenta_households.id` with its own cascade). Since `created_by` was never used for anything beyond bookkeeping, this is now `on delete set null` instead — a household survives its creator leaving, full stop.

If someone's in a household when they delete their account, the confirmation sheet says so explicitly: their own contributed rows disappear, but other members keep what they added.

## Polish pass: sync failures are surfaced, not silent

Every cloud write in the app — 25 call sites across `sheet.js`, `budgets.js`, `income.js`, `loans.js`, `recurring.js`, `bills.js`, and `goals.js` — used to fail silently: `.catch(e => console.error(...))`, nothing shown to the person. That's a real data-loss risk in a budgeting app used somewhere connectivity isn't always solid: add an expense while offline, the sheet closes like normal, and there'd be no sign that entry only exists on this device. If the cloud data gets reloaded later (new session, another device), it's just gone.

`src/toast.js` fixes that — a small `notifySyncError(e)` helper that every one of those 25 call sites now funnels through instead of `console.error` directly. It still logs to the console for debugging, but it also shows a brief toast: _"Couldn't sync to the cloud — this change is only saved on this device right now."_ No retry queue yet (that's a bigger feature — tracking failed writes and re-attempting on reconnect), so the honest framing is "saved locally, you'll want to check your connection," not a false promise that it'll fix itself.

Also added: **busy-state guards** on Sign in / Create account / magic link (`authSheet.js`) and Create / Join household (`householdSheet.js`) — buttons disable and relabel ("Signing in…", "Creating…") while the request is in flight, so a slow connection plus an impatient double-tap can't fire the same request twice (which, for household creation, could otherwise leave someone in two households from one tap).

Every other screen already had a real empty state — Overview, Expenses (both "nothing yet" and "no results for that search" have distinct copy), Income, Bills, Goals, and Utang all had them from when each feature was originally built. Budgets doesn't need one — it always lists all categories with an editable amount, empty or not.

## Tags

Free-form tags sit on top of the fixed category system — a transaction still has exactly one category (for budgets, the donut chart, etc.), but can also have any number of tags for looser, cross-cutting labels a fixed category list can't capture (e.g. "birthday", "work trip", "reimbursable").

- Only available on the regular Add/Edit sheet (`sheet.js`) — bills, goal contributions, and utang entries have their own simpler forms and don't get a tag field, to keep those flows quick.
- The tag input (`.tag-input-wrap` in `sheet.js`) is a self-built chip input: type and hit Enter or comma to add a tag, Backspace on an empty input removes the last one, and each chip has its own × to remove it directly. It only re-renders the chips themselves, not the whole sheet, so the input never loses focus while typing.
- Tags are stored as a plain `tags: string[]` array directly on the transaction — always lowercased, deduplicated on entry. Cloud storage uses a native Postgres `text[]` column (`tags` on `kwenta_transactions`).
- They show up as small pills under the description in both the Expenses and Income lists.
- The Expenses tab's search box matches tags too, alongside description and category — so searching "birthday" finds every transaction tagged that way, regardless of category.

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

**Real-time sync:** household members see each other's changes live, via `src/realtime.js`. It subscribes to Postgres changes (insert/update/delete) on all six shared tables, filtered to the active household, using Supabase Realtime. Multiple changes arriving close together — like editing a recurring entry, which writes to two tables at once — are debounced (800ms) into a single reload instead of firing repeatedly. The subscription is kept in sync with whatever household is currently active via `refreshRealtimeSubscription()` in `main.js`, called after sign-in/out and after creating, joining, or leaving a household. Realtime needs to be enabled per-table in Supabase — `schema.sql` handles that (`alter publication supabase_realtime add table ...`), written defensively so it's safe to re-run.

**A real bug this caught: deletes weren't syncing, only inserts.** By default, Postgres only includes the primary key in a `DELETE` event's payload — not the row's other columns. Since the realtime subscription filters on `household_id`, and that column simply wasn't present in delete events, the filter couldn't match and the event got silently dropped — so removing a goal contribution, deleting an expense, etc. never reached other devices, even though adding one worked fine (inserts always carry full row data regardless of this setting). Fixed with `alter table ... replica identity full` on each shared table, right alongside the publication setup — also safe to re-run.

A couple of things worth knowing: there's no conflict resolution — if two people edit the exact same entry within the same ~800ms window, whichever write reaches the database last wins, silently. And a realtime-triggered reload happens in the background regardless of what you're doing — if you have the add/edit sheet open when it fires, the screen behind it updates, but the sheet itself isn't affected (its fields are read once when it opens, not live-bound to the data), so nothing you're mid-typing gets disrupted.

## Navigation structure

- **Bottom nav** (`components/bottomNav.js`, `state.section`): four top-level destinations — Overview, Goals, Utang, Profile. This is the primary navigation.
- **Overview owns its own sub-tabs** (`components/tabs.js`, `state.tab`): Overview/Income/Expenses/Budgets/Bills — this is the tab bar you see in the sidebar, and it only renders when `state.section === 'overview'`. Goals, Utang, and Profile are full screens with no sub-tabs.
- `main.js`'s `renderSectionContent()` is the single place that decides what to show based on both pieces of state.
- The **sidebar** (month nav / balance card) is also section-aware, via `renderSideContent()` in `main.js` — since Goals, Utang, and Profile aren't scoped to a month, the Net Balance card only appears for Overview. Goals and Profile get no sidebar at all. Utang gets a different card in the exact same visual slot — `renderUtangLedgerCard()` in `loansTab.js` — styled identically to the Net Balance card (same `.ledger-card` markup/CSS) but showing "Owed to you" / "You owe" instead.
- The **floating + button** is hidden entirely on Profile — there's nothing to "add" there (`render()` in `main.js` only inserts it when `state.section !== 'profile'`).

## Profile tab

Account, household, password, theme, and export used to be scattered across header icons and a couple of modals — they now all live in one place (`components/profileTab.js`), each as its own small card:

- **Account** — sign in/out. Tapping the header's account icon (or the Utang/Goals equivalent — there isn't one, it's just the header) jumps straight to this tab now, instead of opening a modal.
- **Household** — only shown when signed in. Opens the same `householdSheet.js` as before; nothing about household logic changed, just where the button to reach it lives.
- **Password** — only shown when signed in. Opens `setPasswordSheet.js` in `'manual'` context, so someone who signed up via magic link (and never got the automatic post-signup prompt, or dismissed it) can set one anytime, and anyone can change an existing password the same way. Same sheet, same validation, as the automatic prompt — just a different heading/button copy depending on how it was opened.
- **Appearance** — the light/dark toggle that used to be a header icon. Clicking it calls `toggleTheme()` then re-renders through the same callback pattern as the other sheets (`initProfileTab(render)` in `main.js`).
- **Export** — the CSV export that used to be a header icon.

## Installable PWA

- Uses `vite-plugin-pwa`, configured in `vite.config.js` — it generates the web manifest and a service worker automatically at build time (`dist/manifest.webmanifest`, `dist/sw.js`), no hand-written service worker code to maintain.
- App icons live in `public/` — `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` (extra padding so Android's adaptive-icon masking doesn't clip the ₱), `apple-touch-icon.png`, and `favicon-32.png`. All generated to match the app's navy/gold branding — the same colors as the header's ₱ mark.
- The service worker precaches the app shell (HTML/CSS/JS/icons) so the app still opens with a flaky connection. It does **not** cache anything from Supabase — API calls always go live, so your data is never stale from a cache.
- **To install:** on Android/desktop Chrome, an install prompt/button appears automatically once the site is served over HTTPS (Vercel gives you this for free). On iOS Safari, there's no automatic prompt — tap Share → **Add to Home Screen**.
- `registerType: 'autoUpdate'` means the service worker updates itself in the background on each visit — you don't need to manually bump a cache version when you deploy a new build.

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
