// بناء + اختبار + نشر بأمر واحد: npm run deploy
import { spawn, execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

function run(cmd, opts) {
  console.log("$ " + cmd);
  execSync(cmd, { stdio: "inherit", ...opts });
}

async function main() {
  // خادم محلّيّ للاختبار فقط (docs/ هي نسخة النشر الجاهزة أصلًا — لا خطوة بناء)
  const server = spawn("python3", ["-m", "http.server", "8745", "--directory", "docs", "--bind", "127.0.0.1"], { stdio: "ignore" });
  await sleep(800);

  try {
    run("node tests/e2e.mjs");
  } catch (e) {
    server.kill();
    console.error("\nفشلت الاختبارات — لن يُنشَر شيء. أصلح الأعطال أوّلًا.");
    process.exit(1);
  }
  server.kill();

  run("git add -A");
  try {
    run('git commit -m "تحديث الموقع"');
  } catch (e) {
    console.log("لا تغييرات لإيداعها.");
  }
  run("git push");
  console.log("\nتمّ الدفع. GitHub Pages يحدّث الرابط الحيّ خلال دقيقة أو دقيقتين عادةً.");
}

main();
