-- 002_fix_withdrawal_reference.sql
--
-- Fixes the withdrawal idempotency guarantee.
--
-- The original unique key was (instructor_id, payout_reference, cancelled_at).
-- cancelled_at is nullable, and SQL treats every NULL as distinct from every
-- other NULL for uniqueness purposes - so two active (non-cancelled)
-- withdrawals with the same instructor_id and payout_reference could both be
-- inserted, since both rows have cancelled_at = NULL. This defeated the
-- retry-safe idempotency the reference column was meant to guarantee.
--
-- Fix: drop cancelled_at from the unique key entirely. A payout_reference
-- must be unique per instructor on its own, regardless of cancellation
-- status.

-- Existing duplicate rows (including the ones inserted while proving this
-- bug in Task 5.2) will block the new unique index from being created.
-- Keep the earliest row (lowest id) per (instructor_id, payout_reference)
-- group and delete the rest.
DELETE t1 FROM wp_bl_withdrawals t1
INNER JOIN wp_bl_withdrawals t2
  ON t1.instructor_id = t2.instructor_id
  AND t1.payout_reference = t2.payout_reference
  AND t1.id > t2.id;

ALTER TABLE wp_bl_withdrawals
  DROP INDEX uq_reference,
  ADD UNIQUE KEY uq_reference (instructor_id, payout_reference);
