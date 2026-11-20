// Clear stored guesses.  `bun run reset` wipes everything; `--sim` removes
// only simulated players.
import { db } from "../src/server/db";

const simOnly = Bun.argv.includes("--sim");
db.transaction(() => {
  if (simOnly) {
    db.run("DELETE FROM guesses WHERE sim = 1");
    db.run("DELETE FROM opens WHERE player LIKE 'sim-%'");
  } else {
    db.run("DELETE FROM guesses");
    db.run("DELETE FROM opens");
  }
})();
console.log(simOnly ? "Removed simulated players." : "All guesses cleared.");
