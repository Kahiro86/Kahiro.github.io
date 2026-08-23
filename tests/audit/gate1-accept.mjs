// Gate 1 acceptance, criteria 1–4, driven in a browser against the built app.
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { extname, join, normalize } from "node:path";
const DIST = fileURLToPath(new URL("../../dist", import.meta.url));
const MIME={".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".svg":"image/svg+xml",".ico":"image/x-icon"};
const server=createServer((q,r)=>{let p=decodeURIComponent((q.url||"/").split("?")[0]);if(p==="/")p="/index.html";const fp=normalize(join(DIST,p));if(!fp.startsWith(DIST)||!existsSync(fp)){r.statusCode=404;return r.end("nf");}r.setHeader("Content-Type",MIME[extname(fp)]||"application/octet-stream");r.end(readFileSync(fp));});
await new Promise(r=>server.listen(0,r));
const BASE=`http://localhost:${server.address().port}/index.html`;
const iso=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const ago=(n)=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
// Pre-merge data: purity days + journal entries, as a returning user would have.
const purity={}, journal=[];
for(let i=1;i<=12;i++) purity[ago(i)] = { s: i===5?"relapse":"pure", triggers: i===5?["Stress"]:[] };
for(const i of [1,3,6]) journal.push({id:`j${i}`,date:ago(i),title:`Entry ${i}`,text:`reflection ${i}`,mood:"steady"});

const errs=[];
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
const page=await b.newPage({viewport:{width:1180,height:1100}});
page.on("pageerror",e=>errs.push(String(e)));
page.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
await page.addInitScript(([p,j])=>{ localStorage.setItem("architect:purity_log",p); localStorage.setItem("architect:journal_entries",j); },
  [JSON.stringify(purity), JSON.stringify(journal)]);
await page.goto(BASE,{waitUntil:"networkidle"});
const dismiss=async()=>{for(const n of["Skip","Skip the tour"]){const x=page.getByRole("button",{name:n,exact:true});try{if(await x.count()){await x.first().click({timeout:1200});await page.waitForTimeout(150);}}catch{}}};
await dismiss();

let pass=0,fail=0; const fails=[];
const ok=(n,c)=>{ if(c){pass++;console.log(`  ✓ ${n}`);} else {fail++;fails.push(n);console.log(`  ✗ ${n}`);} };

console.log("\n── criterion 3: migration ran, nothing lost ──");
const migrated = await page.evaluate(()=>({
  habits: JSON.parse(localStorage.getItem("architect:ht_habits")||"[]"),
  entries: JSON.parse(localStorage.getItem("architect:ht_entries")||"[]"),
  purity: JSON.parse(localStorage.getItem("architect:purity_log")||"{}"),
  journal: JSON.parse(localStorage.getItem("architect:journal_entries")||"[]"),
}));
ok("purity became an abstinence habit", migrated.habits.some(h=>h.id==="sys_purity"&&h.subtype==="abstinence"));
ok("journal became a journal habit", migrated.habits.some(h=>h.id==="sys_journal"&&h.subtype==="journal"));
ok("all 12 purity days carried", migrated.entries.filter(e=>e.habitId==="sys_purity").length===12);
ok("all 3 journal days carried", migrated.entries.filter(e=>e.habitId==="sys_journal").length===3);
ok("purity_log untouched (12 days still there)", Object.keys(migrated.purity).length===12);
ok("journal_entries untouched (3 still there)", migrated.journal.length===3);

// Counts alone survive a silent re-key — criterion 3 asks for spot-checks.
const spotDays = [1,3,5,8,12].map(ago);
const pOk = spotDays.filter((d)=>{
  const e = migrated.entries.find((x)=>x.habitId==="sys_purity" && x.date===d);
  const want = purity[d];
  return e && ((want.s==="pure" && e.value===1) || (want.s==="relapse" && e.value===0));
});
ok(`5 purity days land on their original dates with the right value (${pOk.length}/5)`, pOk.length===5);
ok("the relapse day is a miss, not a completion",
   migrated.entries.find((e)=>e.habitId==="sys_purity" && e.date===ago(5))?.value===0);
ok("purity_log's own rows are byte-identical",
   JSON.stringify(migrated.purity)===JSON.stringify(purity));
const jOk = [1,3,6].map(ago).filter((d)=>migrated.entries.some((e)=>e.habitId==="sys_journal" && e.date===d));
ok(`all 3 journal days land on their original dates (${jOk.length}/3)`, jOk.length===3);
ok("journal_entries keep their text and title",
   migrated.journal.every((e)=>journal.some((o)=>o.id===e.id && o.text===e.text && o.title===e.title)));

console.log("\n── criteria 1 & 2: no top-level Purity/Journal tabs ──");
// Gate 2 retired the Life facet outright, so the check is now that neither
// Purity nor Journal appears as a top-level destination anywhere in the nav.
const navIds = await page.locator('[data-tour^="nav-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-tour")));
const navTxt = (await page.locator('[data-tour^="nav-"]').allInnerTexts()).join(" | ");
ok("no Purity entry in the nav", !/purity/i.test(navTxt));
ok("no Journal entry in the nav", !/journal/i.test(navTxt));
ok("the Life facet that used to host them is gone", !navIds.includes("nav-life"));

console.log("\n── criterion 4: one screen logs all three ──");
await page.locator('[data-tour="nav-habits"]').first().click();
// Wait for the list to actually render rather than for a fixed interval — the
// habits chunk grows, and a sleep that was long enough last month silently
// becomes a false failure.
await page.locator(".grid.row").first().waitFor({ state: "attached", timeout: 15000 }).catch(() => {});
await page.waitForTimeout(250); await dismiss();
const urlBefore = page.url();
const disc = await page.locator("body").innerText();
ok("Discipline lists the pinned Purity habit", /Purity/.test(disc));
ok("Discipline lists the pinned Journal habit", /Journal/.test(disc));

// 1. claim purity inline
const claim = page.locator(".row__claim").first();
ok("purity claim is inline on the list", await claim.count() > 0);
if(await claim.count()){ await claim.click(); await page.waitForTimeout(400); }

// 2. write a journal entry inline — composer opens in place
const jRow = page.locator(".grid.row").filter({ hasText: "Journal" }).first();
const jCell = jRow.locator(".cell:not(.cell--off)").first();
if(await jCell.count()){ await jCell.click(); await page.waitForTimeout(400); }
ok("journal composer opens inline (no route change)", await page.locator(".composer").count() > 0);
if(await page.locator(".composer").count()){
  await page.locator(".composer__text").fill("Logged from the Discipline screen.");
  await page.getByRole("button",{name:"Save entry"}).click();
  await page.waitForTimeout(500);
}
ok("still on the same screen after all three logs", page.url() === urlBefore);

const after = await page.evaluate(()=>({
  purity: JSON.parse(localStorage.getItem("architect:purity_log")||"{}"),
  journal: JSON.parse(localStorage.getItem("architect:journal_entries")||"[]"),
  entries: JSON.parse(localStorage.getItem("architect:ht_entries")||"[]"),
}));
const today = iso(new Date());
ok("the claim reached purity_log for today", after.purity[today]?.s === "pure");
ok("the reflection reached journal_entries", after.journal.some(e=>(e.text||"").includes("Discipline screen")));
ok("both also recorded as habit completions", after.entries.some(e=>e.habitId==="sys_purity"&&e.date===today)
   && after.entries.some(e=>e.habitId==="sys_journal"&&e.date===today));

console.log("");
console.log("ERRORS:", errs.slice(0,5).join(" || ")||"none");
if(fail) console.log("FAILURES:\n  "+fails.join("\n  "));
console.log(`Gate 1 acceptance: ${pass}/${pass+fail} passed`);
await b.close(); server.close();
process.exit(fail||errs.length?1:0);
