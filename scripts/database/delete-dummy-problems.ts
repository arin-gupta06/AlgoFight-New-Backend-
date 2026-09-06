import "dotenv/config";
import { prisma } from "../../packages/database/src/client/prisma";

async function main() {
  console.log("Deleting dummy problems...");
  const dummyProblems = await prisma.problem.findMany({
    where: {
      source: null,
    },
    select: { id: true },
  });

  const ids = dummyProblems.map(p => p.id);

  if (ids.length === 0) {
    console.log("No dummy problems found.");
    return;
  }

  await prisma.submission.deleteMany({
    where: { problemId: { in: ids } },
  });

  await prisma.testCase.deleteMany({
    where: { problemId: { in: ids } },
  });

  const result = await prisma.problem.deleteMany({
    where: { id: { in: ids } },
  });
  console.log(`Deleted ${result.count} dummy problems.`);
}

main()
  .catch((err) => {
    console.error("❌ Delete failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
