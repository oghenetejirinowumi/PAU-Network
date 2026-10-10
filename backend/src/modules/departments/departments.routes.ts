import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

export const departmentsRouter = Router();

departmentsRouter.get("/", async (_req, res) => {
  const departments = await prisma.department.findMany({
    orderBy: [{ school: "asc" }, { name: "asc" }],
    include: { _count: { select: { users: { where: { role: "ALUMNI" } } } } },
  });
  res.json({
    data: departments.map(({ _count, ...department }) => ({ ...department, alumniCount: _count.users })),
  });
});
