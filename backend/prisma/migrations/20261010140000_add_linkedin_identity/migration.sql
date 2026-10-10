ALTER TABLE "users" ADD COLUMN "linkedin_id" TEXT;

CREATE UNIQUE INDEX "users_linkedin_id_key" ON "users"("linkedin_id");
