# Task 5 — Database

## 5.1 Investigate — NULL vs 0

```sql
SELECT id, title, enrolment_count, average_rating FROM wp_bl_courses ORDER BY id;
```

```
+----+------------------------------+-----------------+----------------+
| id | title                        | enrolment_count | average_rating |
+----+------------------------------+-----------------+----------------+
|  1 | Introduction to Bread Baking |             128 |           4.60 |
|  2 | Sourdough Starters           |              64 |           4.20 |
|  3 | Pastry Fundamentals          |            NULL |           NULL |
|  4 | Cake Decorating Basics       |               9 |           0.00 |
|  5 | Advanced Laminated Dough     |               0 |           NULL |
+----+------------------------------+-----------------+----------------+
5 rows in set (0.00 sec)
```

**Which rows are genuinely 0, and which are NULL?**

Course 4 has a genuine `average_rating` of 0.00 - it has been rated, and rated
poorly, not "not yet rated." Course 5 has a genuine `enrolment_count` of 0 -
nobody has enrolled - and its `average_rating` is NULL, which is also correct
here since with zero enrolments nobody could have rated it. Course 3 has NULL
for both fields - it has never been counted or rated at all.

**Why does this matter to a user?** A NULL means "this has never been
measured," while a 0 means "we measured it and the real answer is zero." A
brand-new course showing "0 enrolments" (NULL collapsed to 0) looks exactly
like a failing, unpopular course, when in reality no one has even had the
chance to enrol yet - those are very different situations for an instructor
or learner deciding whether to trust the course.

## 5.2 The constraint

**Proof — two inserts with the same instructor_id and payout_reference:**

```sql
INSERT INTO wp_bl_withdrawals (instructor_id, amount_minor, status, payout_reference, cancelled_at)
VALUES (2, 60000, 'pending', 'dup-test-1', NULL);

INSERT INTO wp_bl_withdrawals (instructor_id, amount_minor, status, payout_reference, cancelled_at)
VALUES (2, 60000, 'pending', 'dup-test-1', NULL);

SELECT id, instructor_id, payout_reference, cancelled_at FROM wp_bl_withdrawals WHERE payout_reference = 'dup-test-1';
```

```
Query OK, 1 row affected (0.01 sec)
Query OK, 1 row affected (0.01 sec)

+----+---------------+------------------+--------------+
| id | instructor_id | payout_reference | cancelled_at |
+----+---------------+------------------+--------------+
|  2 |             2 | dup-test-1       | NULL         |
|  3 |             2 | dup-test-1       | NULL         |
+----+---------------+------------------+--------------+
2 rows in set (0.00 sec)
```

**Did the unique key prevent the duplicate? If not, exactly why?**

No. Both inserts succeeded with no error, producing two rows with identical
instructor_id and payout_reference. cancelled_at is part of the unique key
and is nullable. In SQL, NULL is treated as "unknown," and two unknowns are
never considered equal to each other for uniqueness purposes - so MySQL
treats these two rows as distinct even though the two columns that actually
matter, instructor_id and payout_reference, are identical. The constraint
provides no protection at all for any normal (non-cancelled) withdrawal,
which is every withdrawal at the moment it is created.

**Migration:** `database/migrations/002_fix_withdrawal_reference.sql`

The unique key was (instructor_id, payout_reference, cancelled_at). Because
cancelled_at is nullable and NULL is never equal to another NULL in SQL, two
active withdrawals (both with cancelled_at = NULL) never actually collided
against the constraint. The fix drops cancelled_at from the key entirely -
idempotency is keyed on (instructor_id, payout_reference) alone, which is
what the feature actually needs: a reference must be unique per instructor,
full stop.

**Verification - new constraint:**

```sql
SHOW CREATE TABLE wp_bl_withdrawals\G
```

```
UNIQUE KEY `uq_reference` (`instructor_id`,`payout_reference`),
```

**Verification - the exact same duplicate insert now correctly fails:**

```sql
INSERT INTO wp_bl_withdrawals (instructor_id, amount_minor, status, payout_reference, cancelled_at)
VALUES (2, 60000, 'pending', 'dup-test-1', NULL);
```

```
ERROR 1062 (23000): Duplicate entry '2-dup-test-1' for key 'wp_bl_withdrawals.uq_reference'
```

## 5.3 The query

```sql
SELECT
  c.id,
  c.title,
  COUNT(e.id) AS enrolment_count,
  COALESCE(SUM(e.amount_paid_minor), 0) AS revenue_minor
FROM wp_bl_courses c
LEFT JOIN wp_bl_enrolments e
  ON e.course_id = c.id AND e.refunded_at IS NULL
GROUP BY c.id, c.title
ORDER BY c.id;
```

```
+----+------------------------------+-----------------+---------------+
| id | title                        | enrolment_count | revenue_minor |
+----+------------------------------+-----------------+---------------+
|  1 | Introduction to Bread Baking |               2 |          9000 |
|  2 | Sourdough Starters           |               0 |             0 |
|  3 | Pastry Fundamentals          |               0 |             0 |
|  4 | Cake Decorating Basics       |               0 |             0 |
|  5 | Advanced Laminated Dough     |               0 |             0 |
+----+------------------------------+-----------------+---------------+
```

**Which join type, and why? What would break with a plain INNER JOIN?**

LEFT JOIN from courses to enrolments. With an INNER JOIN, any course with
zero non-refunded enrolments (courses 2-5 here) would disappear from the
results entirely instead of showing a row with 0, since INNER JOIN only
returns rows that have at least one match on both sides. The refund filter
also has to live in the ON clause rather than a WHERE clause: putting it in
WHERE would strip out rows after the join has already happened, so a course
whose enrolments were ALL refunded would lose every one of its joined rows
and vanish from the output too, rather than correctly showing 0. Filtering
inside ON keeps the course's own row from the LEFT JOIN even when nothing on
the enrolments side survives the filter.
