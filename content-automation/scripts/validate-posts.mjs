// Validate the content calendar and report render eligibility — NO rendering,
// NO network, NO publishing. Run: `npm run content:validate`.

import { loadCalendar, schemaErrors, evaluateGuardrails } from "./lib.mjs";

function main() {
  const data = loadCalendar();
  const posts = data.posts;

  let eligible = 0;
  let blocked = 0;
  let schemaBad = 0;
  const rows = [];

  for (const post of posts) {
    const errs = schemaErrors(post);
    if (errs.length) schemaBad++;
    const g = evaluateGuardrails(post);
    if (g.eligible && errs.length === 0) eligible++;
    else blocked++;

    rows.push({ post, errs, g });
  }

  console.log("\n=== Sing My Birthday — content calendar validation ===\n");
  for (const { post, errs, g } of rows) {
    const status = errs.length ? "SCHEMA-ERROR" : g.eligible ? "ELIGIBLE ✅" : "BLOCKED ⛔";
    console.log(`${post.post_id.padEnd(13)} [${post.asset_type}/${post.asset_permission_status}]  ${status}`);
    for (const e of errs) console.log(`    schema: ${e}`);
    for (const r of g.reasons) console.log(`    blocked: ${r}`);
    for (const w of g.warnings) console.log(`    ⚠ warning: ${w}`);
  }

  console.log("\n--- summary ---");
  console.log(`total: ${posts.length}  |  eligible: ${eligible}  |  blocked: ${blocked}  |  schema errors: ${schemaBad}`);
  console.log("(eligible posts are the ones `content:render` will render)\n");

  // Non-zero exit only on schema errors (blocked-by-guardrail is expected/by-design).
  if (schemaBad > 0) process.exit(1);
}

main();
