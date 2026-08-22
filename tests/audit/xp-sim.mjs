// Gate 0 evidence: drives the REAL xpEngine with simulated data to answer
// §4.1 Step 3 questions 4, 5, 8, 10, 12 and the double-count question (3).
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const entry = join(here, "_e.js");
writeFileSync(entry, `
export { computeXp } from "${join(root, "src/shared/xpEngine.js").replace(/\\/g,"/")}";
export { gymSessionsToWorkouts } from "${join(root, "src/modules/gym/gymSessions.js").replace(/\\/g,"/")}";
`);
const out = join(mkdtempSync(join(tmpdir(),"xpsim-")),"b.mjs");
const r = await build({ entryPoints:[entry], bundle:true, format:"esm", platform:"node", write:false, logLevel:"silent" });
writeFileSync(out, r.outputFiles[0].text);
const { computeXp } = await import(pathToFileURL(out).href);

const iso = (d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const ago = (n)=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
const DAYS = 14;

const mkHabit = (id,name)=>({ id,name,icon:null,question:null,type:"boolean",unit:null,target:null,
  targetDirection:"at_least",frequencyType:"daily",frequencyDays:null,frequencyCount:null,routineId:null,
  sortOrder:0,color:null,reminderTime:null,archivedAt:null,
  createdAt:ago(60)+"T12:00:00.000Z",updatedAt:ago(60)+"T12:00:00.000Z" });
// entries for `ids` on the last `days` days, at `rate` completion probability (deterministic)
const mkEntries = (ids, days, rate=1)=>{
  const out=[]; let k=0;
  for(const id of ids) for(let i=0;i<days;i++){
    k++; if ((k%100)/100 >= rate) continue;
    out.push({id:`e${id}${i}`,habitId:id,date:ago(i),value:1,note:null,createdAt:"",updatedAt:""});
  }
  return out;
};
const dailyAvg = (xp)=>{ let s=0; for(let i=0;i<DAYS;i++) s += xp.byDay[ago(i)]||0; return Math.round(s/DAYS); };

console.log("══════ Q4 — CAN TRIVIAL HABITS FARM XP? ══════");
const hard3 = ["h1","h2","h3"].map((i,n)=>mkHabit(i,`Hard habit ${n+1}`));
const base = computeXp({ htHabits:hard3, htEntries:mkEntries(["h1","h2","h3"],DAYS,1) });
const trivial5 = ["t1","t2","t3","t4","t5"].map((i,n)=>mkHabit(i,`Trivial ${n+1}`));
const farmed = computeXp({ htHabits:[...hard3,...trivial5],
  htEntries:mkEntries(["h1","h2","h3","t1","t2","t3","t4","t5"],DAYS,1) });
console.log(`3 habits  → ${dailyAvg(base)} XP/day avg over ${DAYS}d (total ${base.total})`);
console.log(`8 habits  → ${dailyAvg(farmed)} XP/day avg over ${DAYS}d (total ${farmed.total})`);
const delta = dailyAvg(farmed)-dailyAvg(base);
console.log(`DELTA     → +${delta} XP/day (+${Math.round((delta/Math.max(1,dailyAvg(base)))*100)}%) by adding 5 one-second habits`);
console.log(`VERDICT   → ${delta>0?"FARMABLE ❌ — flat per-completion, no decay":"non-gameable ✓"}`);

console.log("\n══════ Q5 — DOES MERE PRESENCE PAY? ══════");
const logins = {}; for(let i=0;i<DAYS;i++) logins[ago(i)]=1;
const presence = computeXp({ logins });
console.log(`app-open only, nothing else logged → ${presence.total} XP total (${dailyAvg(presence)}/day)`);
console.log(`VERDICT   → ${presence.total>0?"PRESENCE PAYS ❌ (V.login=5/day)":"no ✓"}`);

console.log("\n══════ Q3 — DOUBLE COUNT: workout + \"train today\" habit ══════");
const wDay = ago(0);
const workoutOnly = computeXp({ workouts:[{date:wDay,type:"strength",exercises:[]}] });
const habitOnly = computeXp({ htHabits:[mkHabit("tr","Train today")], htEntries:[{id:"x",habitId:"tr",date:wDay,value:1}] });
const both = computeXp({ workouts:[{date:wDay,type:"strength",exercises:[]}],
  htHabits:[mkHabit("tr","Train today")], htEntries:[{id:"x",habitId:"tr",date:wDay,value:1}] });
console.log(`workout alone            → ${workoutOnly.byDay[wDay]||0} XP`);
console.log(`"train today" habit alone→ ${habitOnly.byDay[wDay]||0} XP`);
console.log(`ONE real action, both    → ${both.byDay[wDay]||0} XP`);
console.log(`VERDICT   → ${(both.byDay[wDay]||0) > Math.max(workoutOnly.byDay[wDay]||0, habitOnly.byDay[wDay]||0) ? "DOUBLE-COUNTED ❌":"resolved ✓"}`);

console.log("\n══════ Q8/Q10 — IS XP REMOVED RETROACTIVELY? ══════");
const withHabit = computeXp({ htHabits:hard3, htEntries:mkEntries(["h1","h2","h3"],DAYS,1) });
// deleteHabit cascades its entries (localDb) — simulate h3 deleted
const afterDelete = computeXp({ htHabits:hard3.slice(0,2), htEntries:mkEntries(["h1","h2"],DAYS,1) });
console.log(`before delete → ${withHabit.total} XP`);
console.log(`after deleting 1 of 3 habits → ${afterDelete.total} XP`);
console.log(`VERDICT   → ${afterDelete.total < withHabit.total ? `XP CLAWED BACK ❌ (−${withHabit.total-afterDelete.total})`:"preserved ✓"}`);

console.log("\n══════ Q12 — PROPORTIONALITY: 45-min workout vs one tap ══════");
console.log(`one-tap habit completion → ${habitOnly.byDay[wDay]||0} XP`);
console.log(`full strength session    → ${workoutOnly.byDay[wDay]||0} XP`);
console.log(`ratio                    → ${((workoutOnly.byDay[wDay]||0)/Math.max(1,habitOnly.byDay[wDay]||0)).toFixed(1)}x`);

console.log("\n══════ Q11 — MODULES AWARDING NOTHING ══════");
const firmOnly = computeXp({ firmWithdrawals:[{date:ago(1),amount:50000}] });
console.log(`Firm vault withdrawal/gate cleared → ${firmOnly.total} XP  ${firmOnly.total===0?"❌ unrewarded":""}`);
const sleepOnly = computeXp({ });
console.log(`Sleep floor held (trade_sleep)     → not a dep of computeXp at all → 0 XP ❌ unrewarded`);
process.exit(0);
