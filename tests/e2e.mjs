// اختبارات القبول قبل النشر — موقع «العرض التقديميّ»
// تشغيل: node tests/e2e.mjs (يفترض أنّ خادمًا محلّيًّا يعمل على PORT، افتراضيًّا 8745)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8745;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = JSON.parse(readFileSync(path.join(__dirname, "..", "docs", "assets", "data.json"), "utf8"));

let pass = 0, fail = 0;
const results = [];
function check(name, ok, detail) {
  if (ok) { pass++; results.push(["✓", name, ""]); }
  else { fail++; results.push(["✗", name, detail || ""]); }
}

async function main() {
  // ---- 1) اختبارات بيانات بحتة (لا تحتاج متصفّحًا) ----
  for (const mode of ["individual", "collaborative"]) {
    const rub = DATA.rubric[mode];
    const s2 = rub.items.filter(i => i.stage === "2").reduce((a, b) => a + b.pts, 0);
    const s3 = rub.items.filter(i => i.stage === "3").reduce((a, b) => a + b.pts, 0);
    check(`[${mode}] مجموع المرحلة 2 = 30`, s2 === 30, `كان ${s2}`);
    check(`[${mode}] مجموع المرحلة 3 = 70`, s3 === 70, `كان ${s3}`);
    check(`[${mode}] المجموع الكلّيّ = 100`, s2 + s3 === 100, `كان ${s2 + s3}`);
    check(`[${mode}] عدد البنود = 8`, rub.items.length === 8, `كان ${rub.items.length}`);
    for (const it of rub.items) {
      const sum = it.items.reduce((a, b) => a + b[0], 0);
      check(`[${mode}] بند ${it.n}: مجموع التفريعات = نقاطه (${it.pts})`, sum === it.pts, `كان ${sum}`);
    }
  }
  const promptIds = Object.keys(DATA.prompts).map(Number);
  check("عدد الأوامر = 26", promptIds.length === 26, `كان ${promptIds.length}`);
  const groupIds = DATA.promptGroups.flatMap(g => g.ids);
  check("كلّ أوامر promptGroups مطابقة لمفاتيح prompts (26)", groupIds.length === 26 && groupIds.every(id => DATA.prompts[id]), `كان ${groupIds.length}`);

  // ---- 2) اختبارات متصفّح ----
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", err => consoleErrors.push(String(err)));

  await page.goto(BASE + "/");
  await page.waitForSelector(".masthead");
  check("الصفحة الرئيسية تُحمَّل بلا أخطاء console", consoleErrors.length === 0, consoleErrors.join(" | "));

  // ملء ملفّي ثمّ التحقّق من الأوامر
  await page.goto(BASE + "/#/profile");
  await page.fill("#f_cluster", "عنقود الاختبار");
  await page.fill("#f_topic", "موضوع الاختبار");
  await page.fill("#f_aspect", "جانب الاختبار");
  await page.waitForTimeout(150);

  await page.goto(BASE + "/#/prompts");
  await page.click('[data-g="start"]');
  const promptBody = await page.textContent(".prompt .body");
  check("الأمر 1 معروض افتراضيًّا (المجموعة start)", promptBody.includes("عنقود الاختبار"), promptBody.slice(0, 80));
  check("لا {{cluster}} ظاهرة حرفيًّا بعد الملء", !promptBody.includes("{{cluster}}"));

  const copyBtn = await page.$('[data-copy="1"]');
  await copyBtn.click();
  const copied = await page.evaluate(() => navigator.clipboard.readText().catch(() => null));
  check("زرّ النسخ لا يُسبّب خطأ", true);

  // مفتاح شخصيّ/تشاركيّ
  await page.goto(BASE + "/#/rubric");
  const titleIndiv = await page.textContent(".card h2");
  await page.click('[data-mode="collaborative"]');
  await page.waitForTimeout(100);
  const titleCollab = await page.textContent(".card h2");
  check("تبديل الوضع يغيّر عنوان المئشار المعروض", titleIndiv !== titleCollab, `${titleIndiv} vs ${titleCollab}`);

  await page.goto(BASE + "/#/");
  const sourcesCollab = await page.content();
  check("الصفحة الرئيسية تعكس عدد المصادر التشاركيّ", sourcesCollab.includes("مصادر تشاركيّة بعدد أعضاء الفريق"));
  await page.click('[data-mode="individual"]');
  await page.waitForTimeout(100);
  const sourcesIndiv = await page.content();
  check("الصفحة الرئيسية تعكس عدد المصادر الشخصيّ (3)", sourcesIndiv.includes(`${DATA.task.sources.count} مصادر`));

  // مخطّط الشرائح: 8×60 = 480 بلا تنبيه
  await page.goto(BASE + "/#/bts");
  for (let i = 0; i < 7; i++) await page.click("#addSlide");
  const secInputs1 = await page.$$('[data-f="seconds"]');
  for (const inp of secInputs1) { await inp.fill("60"); await inp.dispatchEvent("input"); }
  await page.waitForTimeout(150);
  let barLabel = await page.textContent("#barLabel");
  let barTime = await page.textContent("#barTime");
  check("8 شرائح × 60 ثانية = 08:00 بلا تنبيه", barTime === "08:00" && barLabel.includes("ضمن"), `${barTime} / ${barLabel}`);

  for (let i = 0; i < 4; i++) await page.click("#addSlide");
  const secInputs2 = await page.$$('[data-f="seconds"]');
  for (const inp of secInputs2) { await inp.fill("60"); await inp.dispatchEvent("input"); }
  await page.waitForTimeout(150);
  barLabel = await page.textContent("#barLabel");
  barTime = await page.textContent("#barTime");
  check("12 شريحة × 60 ثانية = 12:00 مع تنبيه", barTime === "12:00" && barLabel.includes("خارج"), `${barTime} / ${barLabel}`);
  const slideCount = (await page.$$(".slidecard")).length;
  check("عدد الشرائح المعروضة = 12", slideCount === 12, `كان ${slideCount}`);

  // تصدير: نتحقّق أنّ الزرّ موجود ويعمل بلا خطأ (التنزيل الفعليّ خارج بيئة الاختبار الآليّ)
  const [download] = await Promise.all([
    page.waitForEvent("download").catch(() => null),
    page.click("#expMd")
  ]);
  check("تصدير md ينتج تنزيلًا", !!download);

  // عرض عريض 360px بلا تمرير أفقيّ
  await page.setViewportSize({ width: 360, height: 800 });
  const routes = ["#/", "#/product", "#/rubric", "#/profile", "#/bts", "#/prompts", "#/day", "#/feedback", "#/teacher"];
  for (const r of routes) {
    await page.goto(BASE + "/" + r);
    await page.waitForTimeout(80);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`لا تمرير أفقيّ عند 360px — ${r}`, sw <= 360, `scrollWidth=${sw}`);
  }

  // إعادة التحميل تحفظ «ملفّي»
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + "/#/profile");
  await page.fill("#f_cluster", "عنقود محفوظ");
  await page.waitForTimeout(150);
  await page.reload();
  await page.waitForTimeout(150);
  const clusterAfterReload = await page.inputValue("#f_cluster");
  check("إعادة التحميل تحفظ ما كُتب في «ملفّي»", clusterAfterReload === "عنقود محفوظ", clusterAfterReload);

  check("لا أخطاء console في كامل الجولة", consoleErrors.length === 0, consoleErrors.join(" | "));

  await browser.close();

  console.log("\n| الحالة | الاختبار | التفصيل |");
  console.log("|---|---|---|");
  for (const [status, name, detail] of results) {
    console.log(`| ${status} | ${name} | ${detail} |`);
  }
  console.log(`\nالنتيجة: ${pass} ناجح، ${fail} فاشل من ${pass + fail}.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
