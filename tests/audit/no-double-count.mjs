// Gate 1: after the Discipline merge one real action pays once, and no day's
// XP decreases (decision A — banked XP is never reduced).
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,"..","..");
const entry=join(here,"_x.js");
writeFileSync(entry,`export { computeXp } from "${join(root,"src/shared/xpEngine.js").replace(/\\/g,"/")}";`);
const out=join(mkdtempSync(join(tmpdir(),"dc-")),"b.mjs");
const r=await build({entryPoints:[entry],bundle:true,format:"esm",platform:"node",write:false,logLevel:"silent"});
writeFileSync(out,r.outputFiles[0].text);
const { computeXp } = await import(pathToFileURL(out).href);

let pass=0,fail=0; const fails=[];
const ok=(n,c)=>{ if(c) pass++; else {fail++;fails.push(n);} };
const iso=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const ago=(n)=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};

// 30 clean purity days + 30 journaled days, same dates.
const purity={}, journal=[];
for(let i=0;i<30;i++){ purity[ago(i)]={s:"pure",triggers:[]}; journal.push({id:`j${i}`,date:ago(i),text:"entry"}); }

// BEFORE the merge: legacy paths pay.
const before = computeXp({ purity, entries: journal });

// AFTER: system habits exist and carry the same days as entries.
const mk=(id,name,subtype)=>({id,name,subtype,icon:null,question:null,type:"boolean",unit:null,target:null,
  targetDirection:"at_least",frequencyType:"daily",frequencyDays:null,frequencyCount:null,routineId:null,
  sortOrder:0,color:null,reminderTime:null,archivedAt:null,createdAt:ago(40)+"T12:00:00.000Z",updatedAt:""});
const htHabits=[mk("sys_purity","Purity","abstinence"), mk("sys_journal","Journal","journal")];
const htEntries=[];
for(let i=0;i<30;i++){ htEntries.push({id:`p${i}`,habitId:"sys_purity",date:ago(i),value:1});
                       htEntries.push({id:`jj${i}`,habitId:"sys_journal",date:ago(i),value:1}); }
const after = computeXp({ purity, entries: journal, htHabits, htEntries });

// ── the double-count question, isolated ──
// One purity day and one journal day, far apart, so no streak ladder and no
// perfect-day bonus can fire and confuse the completion arithmetic.
const D = ago(200);
const soloPurity = { [D]: { s:"pure", triggers:[] } };
const soloJournal = [{ id:"solo", date:D, text:"one entry" }];
const soloHabits = [mk("sys_purity","Purity","abstinence"), mk("sys_journal","Journal","journal")];
const soloEntries = [{id:"a",habitId:"sys_purity",date:D,value:1},{id:"b",habitId:"sys_journal",date:D,value:1}];
const legacyOnly = computeXp({ purity: soloPurity, entries: soloJournal });
const merged = computeXp({ purity: soloPurity, entries: soloJournal, htHabits: soloHabits, htEntries: soloEntries });
const habitOnly = computeXp({ htHabits: soloHabits, htEntries: soloEntries });
console.log(`isolated day — legacy paths only : ${legacyOnly.byDay[D]} XP  (purity 10 + journal 15)`);
console.log(`isolated day — habit paths only  : ${habitOnly.byDay[D]} XP  (abstinence 15 + journal 15)`);
console.log(`isolated day — BOTH present      : ${merged.byDay[D]} XP`);
ok("one purity day + one journal day pay ONCE, not twice",
   merged.byDay[D] === habitOnly.byDay[D] && merged.byDay[D] < legacyOnly.byDay[D] + habitOnly.byDay[D]);
ok(`merged is not legacy+habit stacked (${legacyOnly.byDay[D]}+${habitOnly.byDay[D]}=${legacyOnly.byDay[D]+habitOnly.byDay[D]})`,
   merged.byDay[D] !== legacyOnly.byDay[D] + habitOnly.byDay[D]);
console.log(`  → legacy suppressed: merged(${merged.byDay[D]}) === habit-only(${habitOnly.byDay[D]}) ✓`);

// Decision A: no day may go DOWN.
let dropped=0, lowest=null;
for(let i=0;i<30;i++){ const d=ago(i); if((after.byDay[d]||0) < (before.byDay[d]||0)){ dropped++; lowest=d; } }
ok(`no day's XP decreased (${dropped} dropped${lowest?`, first ${lowest}`:""})`, dropped===0);
console.log(`total before ${before.total} → after ${after.total}  (${after.total>=before.total?"never reduced ✓":"REDUCED ❌"})`);

// Journeys still populated from the legacy counters.
ok("cleanDays still counted for Purity Road journey", after.stats.cleanDays===30);
ok("journalDays still counted for Written Mind journey", after.stats.journalDays===30);
ok("habitCompletions counted", after.stats.habitCompletions===60);

console.log("");
if(fail) console.log("FAILURES:\n  "+fails.join("\n  "));
console.log(`Double-count guard: ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
