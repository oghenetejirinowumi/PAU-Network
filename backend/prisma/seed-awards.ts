/**
 * Computes historical awards from the seeded points ledger. Runs after prisma/seed.ts (npm run db:seed).
 * Kept separate so each step is a short-lived process.
 */
import type { AwardType } from "../src/generated/prisma/enums.js";
import { prisma } from "../src/lib/prisma.js";
import { computeAward } from "../src/modules/awards/awards.service.js";

async function main() {
  const now = new Date();
  await prisma.award.deleteMany();

  console.log("Monthly awards…");
  const monthlyTypes: AwardType[] = ["ALUMNI_OF_THE_MONTH", "STUDENT_OF_THE_MONTH"];
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let month = new Date(Date.UTC(2025, 0, 1)); month < thisMonth; month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))) {
    for (const type of monthlyTypes) await computeAward(type, month.getUTCFullYear(), month.getUTCMonth() + 1);
  }
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  await computeAward("DEPARTMENT_CHAMPION_OF_THE_MONTH", lastMonth.getUTCFullYear(), lastMonth.getUTCMonth() + 1);

  console.log("Yearly awards for 2025…");
  for (const type of ["ALUMNI_OF_THE_YEAR", "RISING_STAR_OF_THE_YEAR", "SPACE_OF_THE_YEAR"] as AwardType[]) await computeAward(type, 2025);

  // Awards and badges from history should not flood today's notification inbox.
  await prisma.notification.deleteMany({ where: { type: { in: ["BADGE_EARNED", "TIER_REACHED", "AWARD_WON"] } } });

  console.log(`Done: ${await prisma.award.count()} awards.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
