// Loads (or refreshes) the sample leads in whatever database DATABASE_URL points to.
//   DATABASE_URL=postgres://… npm run seed:demo        # Neon / production demo
//   npm run seed:demo                                  # local PGlite in .data/pglite
// Pass --remove to delete them instead. Real leads are never touched.
import { clearSampleLeads, resetSampleLeads } from "@/lib/leads/samples";

async function main() {
  if (process.argv.includes("--remove")) {
    console.log(`Removed ${await clearSampleLeads()} sample leads.`);
  } else {
    console.log(`Loaded ${await resetSampleLeads()} sample leads.`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
