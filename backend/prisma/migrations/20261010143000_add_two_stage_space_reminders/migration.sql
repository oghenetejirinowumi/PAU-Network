ALTER TABLE "space_participants"
DROP COLUMN "reminder_sent_at",
DROP COLUMN "reminder_claimed_at",
ADD COLUMN "reminder_one_hour_sent_at" TIMESTAMP(3),
ADD COLUMN "reminder_one_hour_claimed_at" TIMESTAMP(3),
ADD COLUMN "reminder_15_min_sent_at" TIMESTAMP(3),
ADD COLUMN "reminder_15_min_claimed_at" TIMESTAMP(3);
