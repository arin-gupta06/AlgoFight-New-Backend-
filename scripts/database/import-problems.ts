/**
 * Import authentic competitive-programming problems (with real test cases) into
 * the AlgoFight database from the open `deepmind/code_contests` dataset, served
 * as paginated JSON by the HuggingFace datasets-server (no bulk download, no auth).
 *
 * We select Codeforces-sourced problems (those carry a real `cf_rating`, tags,
 * and time/memory limits) so imported problems have trustworthy metadata AND
 * runnable stdin/stdout test cases for the Piston judge.
 *
 * Usage (from repo root):
 *   pnpm exec tsx scripts/import-problems.ts
 * Env overrides:
 *   IMPORT_COUNT (default 45)  MAX_SCAN (default 1500)  CC_SPLIT (default train)
 *   MAX_HIDDEN (default 20)    MAX_PUBLIC (default 3)
 */
import "dotenv/config";
import { prisma } from "../../packages/database/src/client/prisma";

type Difficulty = "EASY" | "MEDIUM" | "HARD";

const DATASET = "deepmind/code_contests";
const SPLIT = process.env.CC_SPLIT || "train";
const IMPORT_COUNT = Number(process.env.IMPORT_COUNT || 45);
const MAX_SCAN = Number(process.env.MAX_SCAN || 1500);
const PAGE = 20;
const MAX_HIDDEN = Number(process.env.MAX_HIDDEN || 20);
const MAX_PUBLIC = Number(process.env.MAX_PUBLIC || 3);
const REQUEST_DELAY_MS = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ratingToDifficulty(rating: number): Difficulty {
  if (rating <= 1300) return "EASY";
  if (rating <= 1900) return "MEDIUM";
  return "HARD";
}

function limitsFromRow(row: any): { timeLimit: number; memoryLimit: number } {
  const secs = row?.time_limit?.seconds ? Number(row.time_limit.seconds) : 0;
  const nanos = row?.time_limit?.nanos ? Number(row.time_limit.nanos) : 0;
  const timeLimit = Math.round(secs * 1000 + nanos / 1e6) || 2000;
  const memBytes = Number(row?.memory_limit_bytes) || 0;
  const memoryLimit = memBytes > 0 ? Math.round(memBytes / (1024 * 1024)) : 256;
  return { timeLimit, memoryLimit };
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function cleanTitle(name: string): string {
  // code_contests CF names look like "1012_E. Cycle sort" -> keep the human part.
  const m = String(name || "").match(/^\d+_?\w*\.\s*(.+)$/);
  return (m ? m[1] : String(name || "Untitled")).trim() || "Untitled";
}

interface TestPair {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

// Zip a {input:[], output:[]} column into aligned test pairs, capped at `max`.
function zipTests(col: any, isHidden: boolean, max: number): TestPair[] {
  const inputs: string[] = Array.isArray(col?.input) ? col.input : [];
  const outputs: string[] = Array.isArray(col?.output) ? col.output : [];
  const pairs: TestPair[] = [];
  for (let i = 0; i < inputs.length && pairs.length < max; i++) {
    const input = inputs[i];
    const expectedOutput = outputs[i];
    if (typeof input !== "string" || typeof expectedOutput !== "string") continue;
    if (input.trim() === "" || expectedOutput.trim() === "") continue;
    pairs.push({ input, expectedOutput, isHidden });
  }
  return pairs;
}

function isImportable(row: any): boolean {
  const rating = Number(row?.cf_rating) || 0;
  const hasStatement = typeof row?.description === "string" && row.description.trim().length > 30;
  const publicN = Array.isArray(row?.public_tests?.input) ? row.public_tests.input.length : 0;
  const hiddenN =
    (Array.isArray(row?.private_tests?.input) ? row.private_tests.input.length : 0) +
    (Array.isArray(row?.generated_tests?.input) ? row.generated_tests.input.length : 0);
  return rating > 0 && hasStatement && publicN + hiddenN > 0;
}

async function fetchPage(offset: number): Promise<any[]> {
  const url =
    `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(DATASET)}` +
    `&config=default&split=${encodeURIComponent(SPLIT)}&offset=${offset}&length=${PAGE}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "AlgoFight-Importer/1.0" } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: any = await res.json();
      return Array.isArray(json?.rows) ? json.rows.map((r: any) => r.row) : [];
    } catch (err) {
      if (attempt === 4) throw err;
      await sleep(REQUEST_DELAY_MS * attempt * 2);
    }
  }
  return [];
}

async function upsertProblem(row: any): Promise<"created" | "updated"> {
  const rating = Number(row.cf_rating) || 0;
  const difficulty = ratingToDifficulty(rating);
  const { timeLimit, memoryLimit } = limitsFromRow(row);
  const tags: string[] = Array.isArray(row.cf_tags) ? row.cf_tags.filter((t: any) => typeof t === "string") : [];
  const category = tags.length ? titleCase(tags[0]) : null;
  const externalId = `code_contests:${row.name}`;
  const contestId = row.cf_contest_id ? Number(row.cf_contest_id) : 0;
  const sourceUrl =
    contestId > 0 && row.cf_index ? `https://codeforces.com/problemset/problem/${contestId}/${row.cf_index}` : null;

  const publicTests = zipTests(row.public_tests, false, MAX_PUBLIC);
  const hidden = [
    ...zipTests(row.private_tests, true, MAX_HIDDEN),
    ...zipTests(row.generated_tests, true, MAX_HIDDEN),
  ].slice(0, MAX_HIDDEN);
  const testCases = [...publicTests, ...hidden];

  const data = {
    title: cleanTitle(row.name),
    statement: String(row.description),
    difficulty,
    category,
    tags,
    timeLimit,
    memoryLimit,
    source: "code_contests",
    sourceUrl,
  };

  const existing = await prisma.problem.findUnique({ where: { externalId } });
  if (existing) {
    await prisma.$transaction([
      prisma.testCase.deleteMany({ where: { problemId: existing.id } }),
      prisma.problem.update({
        where: { id: existing.id },
        data: { ...data, testCases: { create: testCases } },
      }),
    ]);
    return "updated";
  }

  await prisma.problem.create({ data: { ...data, externalId, testCases: { create: testCases } } });
  return "created";
}


async function main() {
  const existingCount = await prisma.problem.count();
  if (existingCount >= IMPORT_COUNT) {
    console.log(`\n✅ Database already contains ${existingCount} problems. Skipping download.\n`);
    return;
  }

  console.log(`\n📥 Importing up to ${IMPORT_COUNT} problems from ${DATASET} (${SPLIT})`);
  console.log(`   Judge tests per problem: <=${MAX_PUBLIC} public + <=${MAX_HIDDEN} hidden\n`);

  // Keep a balanced spread across difficulties.
  const bucketCap = Math.ceil(IMPORT_COUNT / 3) + 3;
  const buckets: Record<Difficulty, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
  let created = 0;
  let updated = 0;
  let scanned = 0;

  for (let offset = 0; offset < MAX_SCAN && created + updated < IMPORT_COUNT; offset += PAGE) {
    const rows = await fetchPage(offset);
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned++;
      if (created + updated >= IMPORT_COUNT) break;
      if (!isImportable(row)) continue;

      const diff = ratingToDifficulty(Number(row.cf_rating) || 0);
      if (buckets[diff] >= bucketCap) continue;

      try {
        const outcome = await upsertProblem(row);
        buckets[diff]++;
        if (outcome === "created") created++;
        else updated++;
        console.log(
          `  [${created + updated}/${IMPORT_COUNT}] ${outcome === "created" ? "＋" : "↻"} ${diff.padEnd(6)} ${cleanTitle(row.name)}`,
        );
      } catch (err: any) {
        console.warn(`  ⚠️  Skipped "${row.name}": ${err?.message || err}`);
      }
    }

    await sleep(REQUEST_DELAY_MS);
  }

  const total = await prisma.problem.count();
  console.log(
    `\n✅ Done. Created ${created}, updated ${updated} (scanned ${scanned} rows).` +
    ` Distribution: EASY=${buckets.EASY} MEDIUM=${buckets.MEDIUM} HARD=${buckets.HARD}.` +
    ` Total problems in DB: ${total}.\n`,
  );
}

main()
  .catch((err) => {
    console.error("❌ Import failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });