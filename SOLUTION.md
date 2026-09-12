# SOLUTION.md

**Name:** Uloka Ngozi Gift
**Date:** 12 September 2026
**Actual time spent:** Aside the time spent on understanding the codebase and researching on some small issues, I would say betwen 150mins - 200mins

---

## 1. What I completed

| Task                | Status       | Evidence file                                                                                                               |
| ------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 1 — Course list     | done         | evidence/task-1-ui.png, evidence/task-1-network.png                                                                         |
| 2 — Authentication  | done         | evidence/task-2-signedout.png, evidence/task-2-signedin.png, evidence/task-2-network.jpeg, evidence/task-2-unauthorized.png |
| 3 — Withdrawal form | done         | evidence/task-3-validation.png, evidence/task-3-server-error.png, evidence/task-3-success.png, evidence/task-3-network.jpeg |
| 4 — PHP defects     | 4 of 4 found | evidence/task-4-curl.txt                                                                                                    |
| 5 — Database        | done         | answers/task-5.md, database/migrations/002_fix_withdrawal_reference.sql                                                     |
| 6 — Infrastructure  | done         | answers/task-6.md                                                                                                           |
| 7 — Python          | done         | evidence/task-7-output.txt                                                                                                  |

## 2. What I did NOT finish, and how I would approach it

Everything scoped in the seven tasks is complete. If I had more time I would
add automated tests around the withdrawal form (the amount validation logic
in particular is exactly the kind of pure-ish function that is cheap to unit
test) and around the four PHP fixes, since right now all of Task 4's proof is
manual curl evidence rather than a regression test that would catch the same
bug coming back. I would estimate half a day to add a small PHPUnit suite for
the four defects and a React Testing Library suite for the withdrawal form's
validation states.

## 3. Task 4 — the defects

**Defect 1 (permission):** `GET /me/earnings` used `check_authenticated` as
its `permission_callback`, which only checks that a request carries a valid
token, not which role that token belongs to. A learner's token received a
real `200` with earnings data instead of the documented `403`. Changed the
callback to `check_instructor`, which checks both. Proved with curl: a
learner token now gets `403 {"code":"forbidden",...}`, and the instructor
token still gets a real `200` with correct balances.

**Defect 2 (schema):** `get_course()` read `$row->lessons_total`, a property
that does not exist - the migration creates the column as `lesson_count`.
Since PHP returns null for a nonexistent property, the `?? 0` fallback fired
every time and `lessonCount` was always 0 regardless of the real value.
Changed `lessons_total` to `lesson_count`. Proved with curl against
`/courses/1`: `lessonCount` went from `0` to the correct `12`.

**Defect 3 (contract):** `get_courses()`'s SQL query had no `WHERE` clause at
all, so it returned every course regardless of publish status. The one
unpublished seed course ("Advanced Laminated Dough") appeared in the public
`/courses` list. Added `WHERE c.is_published = 1`. Proved with curl: a grep
for `"isPublished":false` in the response went from matching to returning
nothing.

**Defect 4 (validation):** `create_withdrawal()` checked
`insufficient_balance` and `withdrawal_in_progress` but never compared the
requested amount against `MINIMUM_WITHDRAWAL_MINOR`, so `below_minimum`, a
documented business rule, was never enforced - a withdrawal of ₦10 succeeded
with a `201`. Added a check for `amount < self::MINIMUM_WITHDRAWAL_MINOR`
before the existing balance check. Proved with curl: the same request now
correctly returns `422 {"code":"below_minimum",...}`.

## 4. Specific questions

**Task 1:** `previewExpiresInSeconds` is read from the API response itself
and used to drive React Query's `refetchInterval` (as a function reading
`query.state.data.previewExpiresInSeconds`), so the list automatically
refetches once the server-declared TTL elapses. I did this rather than
hardcoding a refresh interval because the server owns that number - if it
ever changes server-side, the frontend follows it automatically instead of
drifting out of sync silently.

**Task 3:** `payoutReference` must stay the same across retries of one
attempt because it is what the server uses to recognise "this is the same
withdrawal I already saw" versus "this is a new one." If it were regenerated
on every retry, a request that actually succeeded on the server but whose
response was lost in transit (a dropped connection, a timeout) would look,
to the client, like a failure worth retrying - and that retry, carrying a
brand-new reference, would sail straight past the server's duplicate check
and create a second real withdrawal. That is money moving twice for
something the user did once. In my implementation, the reference is
generated once on mount and only rotated after a genuine success; a failed
attempt keeps the same reference so a resubmission is a safe retry, not a
new, distinct request.

**Task 5.2:** The unique key was `(instructor_id, payout_reference,
cancelled_at)`. `cancelled_at` is nullable, and SQL treats every `NULL` as
distinct from every other `NULL` for uniqueness purposes - so two active
withdrawals, both with `cancelled_at = NULL`, never actually collided
against the constraint, proven by inserting the exact same
`(instructor_id, payout_reference)` pair twice with no error. I added a new
migration rather than editing `001_initial.sql` because that migration has
already run against the live database - editing it retroactively changes
nothing for this environment and would silently rewrite schema history for
anyone applying migrations from scratch later. Migrations are forward-only.

**Task 7:** I treated `"fee_minor": null` as a zero fee, not an error. This
is an operational reconciliation script that has to process a whole batch;
aborting on one row with an incomplete fee is worse than assuming the most
plausible interpretation (no fee was charged for that payout, e.g. a
fee-exempt instructor tier) and continuing. The real, more serious bug in
the original script was that a _missing_ `fee_minor` key crashed the whole
run with a `KeyError` on a completely unrelated row (instructor 11's
payout), which I fixed with `.get("fee_minor") or 0` so both the missing-key
and explicit-null cases are handled the same way.

## 5. Anything wrong in our brief

None found beyond the four intentional defects and the database bug -
everything else in the API contract, docs, and starter code was internally
consistent.

## 6. AI Tool Usage — required

**Which tools did you use?** Claude (Anthropic), used throughout, in a
step-by-step pairing style: for every task, Claude explained the reasoning
and proposed the exact change first, and I typed it into my own files,
ran every command myself, and read every terminal output myself before we
moved on.

### 6a. Where AI was used

| Task | What AI produced                                                                     | Accepted / rejected / modified                                                                              |
| ---- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 1    | React Query course list component, refetchInterval approach                          | Accepted, verified against real browser output                                                              |
| 2    | Login page, protected earnings page, completed response interceptor                  | Accepted, verified with real instructor/learner logins and a real 401 test                                  |
| 3    | Withdrawal form, zod validation schema, payoutReference stability logic              | Accepted, verified with real client and server rejection tests                                              |
| 4    | Diagnosis of all 4 PHP defects by reading the source, and the one-line fixes         | Accepted, verified with curl before/after every defect                                                      |
| 5    | Diagnosis of the NULL-key bug, the corrective migration SQL, and the join query      | Accepted, verified by reproducing the bug live, then confirming the fix and re-testing the duplicate insert |
| 6    | Draft reasoning for all 3 infrastructure incidents                                   | Accepted as written - no execution possible/required for this task                                          |
| 7    | Diagnosis and fix of the Python script's crash, missing status filter, and exit code | Accepted, verified by running the fixed script myself against the real data and a missing file              |

### 6b. What you accepted or rejected, and why

I accepted the great majority of what was proposed, but only after it was
explained to me and I watched it produce the correct, verifiable result
myself - I did not paste anything I could not point to a specific reason
for. The one place I actively intervened rather than just accepting: when
testing Task 3's server-side rejection path, I initially would not have
known that client-side and server-side validation, using identical numbers,
never naturally disagree - Claude explained why we needed to temporarily
loosen the client-side props to force a real request through to the server,
and I made sure to revert that temporary change afterward and verified the
revert with a grep before moving on, since submitting that loosened check by
accident would have been a real bug.

### 6c. What you verified yourself, and how

For every one of the four PHP defects, I ran the actual curl command myself,
before and after each fix, and read the actual HTTP status code and JSON
body back. For Task 1 and 2, I opened the real pages in my own browser,
signed in with both the instructor and learner test accounts, and read the
actual UI output and DevTools Network tab myself. For Task 3, I submitted
real amounts through the real form (below minimum, a forced server
rejection, and a genuinely valid amount) and read the resulting messages
myself. For Task 5, I ran every SQL statement myself in an interactive
`mysql>` session, including proving the bug with a real duplicate insert
before the fix and a real rejected insert after it. For Task 7, I ran the
fixed script myself, twice, against the real payouts file and a missing
file, and read the real exit codes.

### 6d. Assumptions you made

I assumed `fee_minor: null` should be treated as a zero fee rather than an
error (reasoning given in section 4). I assumed the withdrawal form's amount
should be entered by the user in major currency units (naira) rather than
raw minor units, converting to `amountMinor` on submit, since that is how a
real user would expect to type an amount. I assumed the `Idempotency-Key`
header value should be identical to the `payoutReference` in the request
body, since the contract implies they represent the same concept and the
PHP code's idempotency check reads the reference from the body.

> I can walk through and explain every change listed above in a technical
> conversation - each one was verified against real, live output on my own
> machine before I considered it done.

## 7. Assumptions and trade-offs

I assumed a reasonable person reviewing this would rather see explicit,
truthful error states (a distinct message for "signed out," "forbidden,"
"transport failure," "session expired") than a single generic error state,
even though it meant slightly more code in the earnings page than the
minimum needed to pass. I also chose to build the withdrawal form directly
into the `/earnings` page rather than a separate `/withdrawals` route, since
the starter code's placeholder link pointed at a route that was never
scaffolded, and the task brief itself lists the route as `/earnings`.

## 8. If this went to production tomorrow

The biggest thing that would worry me: `availableMinor` in the earnings
ledger query does not appear to be reduced by existing pending withdrawals,
only by ledger entries becoming available. That means an instructor could
plausibly submit more than one withdrawal in sequence against the same
"available" balance before the first one clears, since pending withdrawals
are not subtracted from what is shown as available. That was outside the
four defects I was asked to fix, but it is the kind of thing I would raise
immediately in a real production review rather than sit on. I would also
want proper automated test coverage before shipping any of Tasks 1-4 for
real - everything here is proven correct by manual verification, which is
enough for this assessment but not enough for a system that moves money.
