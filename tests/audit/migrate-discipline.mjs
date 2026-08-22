// Gate 1 criterion 3: every purity day and journal entry survives the merge on
// its ORIGINAL date, the source stores are untouched, and re-running is a no-op.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const store = new Map();
globalThis.localStorage = { getItem:(k)=>store.has(k)?store.get(k):null, setItem:(k,v)=>store.set(k,String(v)),
  removeItem:(k)=>store.delete(k), key:(i)=>[...store.keys()][i], get length(){return store.size;} };
const entry = join(here, "_m.js");
writeFileSync(entry, `export * from "${join(root,"src/modules/habits/migrateDiscipline.js").replace(/\\/g,"/")}";`);
const out = join(mkdtempSync(join(tmpdir(),"mig-")),"b.mjs");
const r = await build({ entryPoints:[entry], bundle:true, format:"esm", platform:"node", write:false, logLevel:"silent" });
writeFileSync(out, r.outputFiles[0].text);
const M = await import(pathToFileURL(out).href);

let pass=0, fail=0; const fails=[];
const ok=(n,c)=>{ if(c) pass++; else { fail++; fails.push(n); } };
const eq=(n,g,w)=>ok(`${n} (got ${JSON.stringify(g)}, want ${JSON.stringify(w)})`, JSON.stringify(g)===JSON.stringify(w));

// Realistic sources: 25 clean + 4 relapses across two months, 6 journal entries.
const purity={}, PURE=[], REL=["2026-07-28","2026-08-03","2026-08-04","2026-08-10"];
for(let d=1; d<=25; d++){ const ds=`2026-08-${String(d).padStart(2,"0")}`; if(!REL.includes(ds)){ purity[ds]={s:"pure",triggers:[]}; PURE.push(ds);} }
for(const ds of REL) purity[ds]={s:"relapse",t:22,triggers:["Late-night phone"]};
const journal=[
  {id:"j1",date:"2026-08-19",title:"Held the line",text:"Didn't take the setup.",mood:"sharp",gm:71},
  {id:"j2",date:"2026-08-16",title:"",text:"Go big",mood:"steady",gm:64},
  {id:"j3",date:"2026-08-11",title:"",text:"Harder than easier.",mood:"drained",gm:38},
  {id:"j4",date:"2026-08-06",title:"",text:"Tired.",mood:"flat",gm:44},
  {id:"j5",date:"2026-08-02",title:"",text:"Clean day.",mood:"sharp",gm:67},
  {id:"j6",date:"2026-08-02",title:"second same day",text:"two entries one day",mood:null,gm:67},
];
store.set("architect:purity_log", JSON.stringify(purity));
store.set("architect:journal_entries", JSON.stringify(journal));
const srcPurityBefore = store.get("architect:purity_log");
const srcJournalBefore = store.get("architect:journal_entries");

const writeFn=(k,v)=>store.set("architect:"+k, JSON.stringify(v));
const rep = M.runDisciplineMigration(writeFn);
const habits = JSON.parse(store.get("architect:ht_habits")||"[]");
const entries = JSON.parse(store.get("architect:ht_entries")||"[]");

console.log("── migration report ──");
console.log(`  purity days   : ${rep.purityDays}  (${rep.purityPure} clean / ${rep.purityRelapse} relapse)`);
console.log(`  journal entries: ${rep.journalEntries} across ${new Set(journal.map(j=>j.date)).size} distinct days`);
console.log(`  habits created : ${rep.habitsCreated}`);
console.log(`  legacy skipped days found: ${rep.skippedDays}`);

// ── criterion 3: nothing lost, original dates intact ──
eq("purity days counted", rep.purityDays, 26); // 25 Aug days − 3 Aug relapses = 22 clean, + 1 Jul relapse
eq("clean/relapse split", [rep.purityPure, rep.purityRelapse], [22, 4]);
const pEntries = entries.filter(e=>e.habitId===M.PURITY_HABIT_ID);
eq("one entry per purity day", pEntries.length, 26);
ok("every purity date present on its ORIGINAL date",
   Object.keys(purity).every(d => pEntries.some(e=>e.date===d)));
ok("pure → 1, relapse → 0", PURE.every(d=>pEntries.find(e=>e.date===d).value===1)
   && REL.every(d=>pEntries.find(e=>e.date===d).value===0));
const jEntries = entries.filter(e=>e.habitId===M.JOURNAL_HABIT_ID);
eq("one entry per journaled DAY (2 entries on 08-02 → 1 day)", jEntries.length, 5);
ok("every journal date present on its ORIGINAL date",
   [...new Set(journal.map(j=>j.date))].every(d => jEntries.some(e=>e.date===d)));

// ── subtypes wired, engine shared ──
eq("purity habit subtype", habits.find(h=>h.id===M.PURITY_HABIT_ID)?.subtype, "abstinence");
eq("journal habit subtype", habits.find(h=>h.id===M.JOURNAL_HABIT_ID)?.subtype, "journal");
ok("both are ordinary daily boolean habits (one engine)",
   habits.every(h=>h.type==="boolean" && h.frequencyType==="daily"));

// ── source stores untouched ──
eq("purity_log byte-identical after migration", store.get("architect:purity_log"), srcPurityBefore);
eq("journal_entries byte-identical after migration", store.get("architect:journal_entries"), srcJournalBefore);

// ── idempotent ──
const before = store.get("architect:ht_entries");
M.runDisciplineMigration(writeFn);
M.runDisciplineMigration(writeFn);
eq("re-running twice adds nothing", store.get("architect:ht_entries"), before);

// ── a day logged AFTER migration is not clobbered ──
const post = JSON.parse(store.get("architect:ht_entries"));
post.push({id:"live",habitId:M.PURITY_HABIT_ID,date:"2026-08-26",value:1,note:null,createdAt:"",updatedAt:""});
store.set("architect:ht_entries", JSON.stringify(post));
store.set("architect:purity_log", JSON.stringify({...purity, "2026-08-26":{s:"pure",triggers:[]}}));
M.runDisciplineMigration(writeFn);
const after = JSON.parse(store.get("architect:ht_entries")).filter(e=>e.date==="2026-08-26" && e.habitId===M.PURITY_HABIT_ID);
eq("post-migration day not duplicated", after.length, 1);

// ── a fresh install still gets both pinned rows ──
store.clear();
M.runDisciplineMigration(writeFn);
const fresh = JSON.parse(store.get("architect:ht_habits")||"[]");
ok("fresh install pins Purity with no legacy data", fresh.some(h=>h.id===M.PURITY_HABIT_ID));
ok("fresh install pins Journal with no legacy data", fresh.some(h=>h.id===M.JOURNAL_HABIT_ID));
eq("fresh install writes no entries", JSON.parse(store.get("architect:ht_entries")||"[]").length, 0);

// ── deleting a pinned row is the user's decision, boot does not undo it ──
store.set("architect:ht_habits", JSON.stringify(fresh.filter(h=>h.id!==M.PURITY_HABIT_ID)));
M.runDisciplineMigration(writeFn);
ok("a deleted pinned habit is not resurrected on the next boot",
   !JSON.parse(store.get("architect:ht_habits")).some(h=>h.id===M.PURITY_HABIT_ID));

console.log("");
if(fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Discipline migration: ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
