// العرض التقديميّ — تاريخ مملكتيّ — البجروت المرنة
// موقع ثابت، بلا خادم ولا تسجيل دخول. مصدر الحقيقة الوحيد: assets/data.json

(function () {
  "use strict";

  var DATA = null;
  var LS_PREFIX = "pr23_";

  // ---------- تخزين محليّ ----------
  function lsGet(key, fallback) {
    try {
      var raw = localStorage.getItem(LS_PREFIX + key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function lsSet(key, value) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    } catch (e) {}
  }

  function emptySource() {
    return { title: "", author: "", org: "", year: "", type: "", page: "", whyTrust: "", whyRelevant: "", expectedRating: "" };
  }
  function emptyProfile() {
    return {
      cluster: "", topic: "", presentationName: "", aspect: "",
      term1: "", term2: "", term3: "", insightValue: "",
      sources: [emptySource(), emptySource(), emptySource()]
    };
  }
  function emptySlide(n) {
    return { n: n, goal: "", talk: "", show: "", visualSource: "", terms: "", sources: "", owner: "", seconds: 60 };
  }

  function getMode() { return lsGet("mode", "individual"); }
  function setMode(m) { lsSet("mode", m); }
  function getProfile() {
    var p = lsGet("profile", null);
    if (!p) return emptyProfile();
    var base = emptyProfile();
    for (var k in base) if (p[k] === undefined) p[k] = base[k];
    if (!Array.isArray(p.sources) || p.sources.length !== 3) p.sources = base.sources;
    return p;
  }
  function setProfile(p) { lsSet("profile", p); }
  function getSlides() {
    var s = lsGet("slides", null);
    if (!s || !s.length) return [emptySlide(1)];
    return s;
  }
  function setSlides(s) { lsSet("slides", s); }
  function getRubricChecks() { return lsGet("rubricChecks", {}); }
  function setRubricChecks(v) { lsSet("rubricChecks", v); }
  function getPromptsUsed() { return lsGet("promptsUsed", {}); }
  function setPromptsUsed(v) { lsSet("promptsUsed", v); }
  function getDayChecks() { return lsGet("dayChecks", {}); }
  function setDayChecks(v) { lsSet("dayChecks", v); }
  function getBtsChecks() { return lsGet("btsSelfChecks", {}); }
  function setBtsChecks(v) { lsSet("btsSelfChecks", v); }

  // ---------- أدوات عامّة ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  function downloadText(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || "text/plain") + ";charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 1000);
  }
  function fillPlaceholders(text, profile) {
    var cluster = profile.cluster || "{{cluster}}";
    var topic = profile.topic || "{{topic}}";
    var aspect = profile.aspect || "{{aspect}}";
    return text
      .split("{{cluster}}").join(cluster)
      .split("{{topic}}").join(topic)
      .split("{{aspect}}").join(aspect);
  }
  function highlightFilled(text, profile) {
    var out = esc(text);
    function wrap(ph, val) {
      var mark = val ? '<span class="fill">' + esc(val) + "</span>" : '<span class="fill">' + ph + "</span>";
      out = out.split(esc(ph)).join(mark);
    }
    wrap("{{cluster}}", profile.cluster);
    wrap("{{topic}}", profile.topic);
    wrap("{{aspect}}", profile.aspect);
    return out;
  }

  // ---------- التنقّل ----------
  var NAV = [
    { h: "#/", t: "الرئيسية" },
    { h: "#/product", t: "المنتَج والمراحل" },
    { h: "#/rubric", t: "المئشار" },
    { h: "#/profile", t: "ملفّي" },
    { h: "#/bts", t: "ما وراء الكواليس" },
    { h: "#/prompts", t: "الأوامر للبوت" },
    { h: "#/day", t: "يوم العرض" },
    { h: "#/feedback", t: "المردودية" },
    { h: "#/teacher", t: "المعلّم" }
  ];

  function renderNav() {
    var cur = location.hash || "#/";
    var nav = document.getElementById("nav");
    nav.innerHTML = "";
    NAV.forEach(function (item) {
      var a = document.createElement("a");
      a.href = item.h;
      a.textContent = item.t;
      if (item.h === cur) a.className = "on";
      nav.appendChild(a);
    });
  }

  function renderMeta() {
    var mode = getMode();
    var box = document.getElementById("metaBox");
    box.innerHTML =
      '<div class="modeswitch" role="group" aria-label="نوع العرض">' +
      '<button data-mode="individual" aria-pressed="' + (mode === "individual") + '">شخصيّ</button>' +
      '<button data-mode="collaborative" aria-pressed="' + (mode === "collaborative") + '">تشاركيّ</button>' +
      "</div>";
    box.querySelectorAll("button[data-mode]").forEach(function (b) {
      b.addEventListener("click", function () {
        setMode(b.getAttribute("data-mode"));
        renderMeta();
        render();
      });
    });
  }

  function router() {
    var hash = location.hash || "#/";
    var path = hash.replace(/^#\/?/, "").split("?")[0];
    return path || "";
  }

  var VIEWS = {};

  function render() {
    renderNav();
    renderMeta();
    var path = router();
    var fn = VIEWS[path] || VIEWS[""];
    var view = document.getElementById("view");
    view.innerHTML = "";
    try {
      fn(view);
    } catch (e) {
      view.innerHTML = '<div class="card err">حدث خطأ في عرض الصفحة: ' + esc(e.message) + "</div>";
      if (window.console) console.error(e);
    }
  }

  // ================= الصفحة 1: الرئيسية =================
  VIEWS[""] = function (view) {
    var mode = getMode();
    var t = DATA.task;
    var stagesHtml = t.stages.map(function (s) {
      return (
        '<li style="margin-bottom:10px"><b>' + s.n + ". " + esc(s.name) + "</b> — " + esc(s.what) +
        ' <span class="tag ' + (s.submit ? "red" : "") + '">' + (s.submit ? "تُسلَّم" : "لا تُسلَّم") + "</span>" +
        (s.note ? '<div class="small muted">' + esc(s.note) + "</div>" : "") +
        "</li>"
      );
    }).join("");

    var termsLine, sourcesLine;
    if (mode === "individual") {
      termsLine = t.terms.count + " مصطلحات تاريخية مختلفة، مؤكَّدة بخطّ عريض، + مصطلح/قيمة ساعدت في بلورة التبصّر.";
      sourcesLine = t.sources.count + " مصادر مختلفة موثوقة، غير كتاب التعليم.";
    } else {
      termsLine = "مصطلحات تشاركيّة بعدد أعضاء الفريق + مصطلحان شخصيّان (حجم الفريق غير مذكور في الوثائق المتوفّرة).";
      sourcesLine = "مصادر تشاركيّة بعدد أعضاء الفريق + مصدران شخصيّان، غير كتاب التعليم.";
    }

    view.appendChild(el(
      '<div class="stack">' +
      '<div class="card"><h2><span class="num">1</span>المهمّة في دقيقة</h2>' +
      "<p>" + esc(t.what) + "</p>" +
      "<ul>" + stagesHtml + "</ul>" +
      "</div>" +

      '<div class="card"><h2><span class="num">2</span>ما يُطلَب منك حالًا</h2>' +
      '<div class="grid2">' +
      '<div><span class="tag blue">الزمن</span><p>' + t.presentation.minutes_min + "-" + t.presentation.minutes_max + " دقائق للتقديم الشفويّ.</p></div>" +
      '<div><span class="tag amber">التسجيل</span><p>' + esc(t.presentation.recording) + "</p></div>" +
      '<div><span class="tag green">الملفّ</span><p>' + esc(t.presentation.file) + "</p></div>" +
      '<div><span class="tag red">المصطلحات</span><p>' + esc(termsLine) + "</p></div>" +
      '<div><span class="tag red">المصادر</span><p>' + esc(sourcesLine) + "</p></div>" +
      '<div><span class="tag blue">البوت</span><p>استعماله إلزاميّ — ' + esc(t.ai.tool) + ".</p></div>" +
      "</div></div>" +

      '<div class="card"><h2><span class="num">3</span>قواعد الذكاء الاصطناعيّ</h2>' +
      '<div class="grid2">' + t.ai.principles.map(function (p) {
        return '<div><b>' + esc(p.t) + "</b><p class=\"small\">" + esc(p.d) + "</p></div>";
      }).join("") + "</div>" +
      '<div class="warn" style="margin-top:12px">' + esc(t.ai.forbidden) + "</div>" +
      "</div>" +

      '<div class="card"><a class="btn" href="#/profile" style="display:inline-block;text-decoration:none">ابدأ بملء «ملفّي» ←</a></div>' +
      "</div>"
    ));
  };

  // ================= الصفحة 2: المنتَج والمراحل =================
  VIEWS["product"] = function (view) {
    var t = DATA.task;
    var compHtml = t.product.components.map(function (c, i) {
      return '<li style="margin-bottom:10px"><b>' + (i + 1) + ".</b> " + esc(c) + "</li>";
    }).join("");
    var glossHtml = DATA.glossary.map(function (g) {
      return (
        '<div class="term"><span class="he">' + esc(g.he) + '</span><div class="ar">' + esc(g.ar) + "</div>" +
        '<div class="def">' + esc(g.def) + "</div></div>"
      );
    }).join("");

    view.appendChild(el(
      '<div class="stack">' +
      '<div class="card"><h2><span class="num">1</span>المنتَج — ' + esc(t.product.form) + "</h2>" +
      "<p class=\"small muted\">مكوّناته التسعة بترتيبها:</p>" +
      "<ol>" + compHtml + "</ol></div>" +
      '<div class="card"><h2><span class="num">2</span>معجم مصطلحات المهمّة</h2><div class="gloss">' + glossHtml + "</div></div>" +
      "</div>"
    ));
  };

  // ================= الصفحة 3: المئشار =================
  VIEWS["rubric"] = function (view) {
    var mode = getMode();
    var rub = DATA.rubric[mode];
    var stage = lsGet("rubricStage", "2");
    var checks = getRubricChecks();
    if (!checks[mode]) checks[mode] = {};

    var items = rub.items.filter(function (it) { return it.stage === stage; });
    var stageTotal = items.reduce(function (a, b) { return a + b.pts; }, 0);

    var wrap = el('<div class="stack"></div>');
    var head = el(
      '<div class="card"><h2><span class="num">3</span>' + esc(rub.title) + " <span class=\"small muted\">(محدَّث " + esc(rub.updated) + ")</span></h2>" +
      '<div class="stages" id="stageTabs">' +
      '<button data-s="2" aria-selected="' + (stage === "2") + '">المرحلة 2</button>' +
      '<button data-s="3" aria-selected="' + (stage === "3") + '">المرحلة 3</button>' +
      "</div></div>"
    );
    wrap.appendChild(head);

    items.forEach(function (it) {
      var key = "n" + it.n;
      if (!checks[mode][key]) checks[mode][key] = {};
      var subHtml = it.items.map(function (pair, idx) {
        var pts = pair[0], text = pair[1];
        var on = !!checks[mode][key][idx];
        return (
          '<li><input type="checkbox" data-item="' + key + '" data-sub="' + idx + '" ' + (on ? "checked" : "") + ">" +
          '<span class="p">' + pts + "</span><span>" + esc(text) + "</span></li>"
        );
      }).join("");
      var card = el(
        '<div class="rubitem"><div class="head"><h3>بند ' + it.n + " — " + esc(it.title) + "</h3>" +
        '<span class="pts">' + it.pts + " نقطة</span></div>" +
        '<span class="tag ' + (it.grade === "تشاركيّ" ? "blue" : "amber") + '">' + esc(it.grade) + "</span>" +
        (it.skills ? '<div class="skills">المهارات: ' + esc(it.skills) + "</div>" : "") +
        (it.warn ? '<div class="warn" style="margin-top:10px">' + esc(it.warn) + "</div>" : "") +
        '<ul class="rubsub">' + subHtml + "</ul></div>"
      );
      wrap.appendChild(card);
    });

    wrap.appendChild(el('<div class="stagesum"><span>مجموع المرحلة ' + stage + "</span><span>" + stageTotal + " نقطة</span></div>"));
    view.appendChild(wrap);

    view.querySelectorAll("#stageTabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        lsSet("rubricStage", b.getAttribute("data-s"));
        render();
      });
    });
    view.querySelectorAll('input[data-item]').forEach(function (cb) {
      cb.addEventListener("change", function () {
        var k = cb.getAttribute("data-item"), s = cb.getAttribute("data-sub");
        checks[mode][k][s] = cb.checked;
        setRubricChecks(checks);
      });
    });
  };

  // ================= الصفحة 4: ملفّي =================
  VIEWS["profile"] = function (view) {
    var p = getProfile();
    var saveFlag;

    function field(labelText, key, opts) {
      opts = opts || {};
      var tag = opts.area ? "textarea" : "input";
      var attrs = opts.area ? ' rows="3"' : ' type="text"';
      return (
        '<div class="formrow"><label for="f_' + key + '">' + esc(labelText) + "</label>" +
        "<" + tag + ' id="f_' + key + '" data-k="' + key + '"' + attrs + ">" + (opts.area ? esc(p[key]) : "") + "</" + tag + ">" +
        (opts.area ? "" : "") +
        (opts.hint ? '<div class="hint">' + esc(opts.hint) + "</div>" : "") +
        "</div>"
      );
    }

    var card1 = el(
      '<div class="card"><h2><span class="num">1</span>الموضوع والعنوان</h2>' +
      field("العنقود", "cluster") +
      field("الموضوع / المسألة / المعضلة", "topic", { area: true, hint: "الأفضل أن يُصاغ سؤالًا أو معضلة لا عنوان سرد." }) +
      field("اسم العرض", "presentationName") +
      field("الجانب", "aspect", { hint: "اقتصاديّ، سياسيّ، اجتماعيّ، تاريخيّ…" }) +
      "</div>"
    );

    var card2 = el(
      '<div class="card"><h2><span class="num">2</span>المصطلحات الثلاثة + قيمة التبصّر</h2>' +
      field("المصطلح الأوّل", "term1") +
      field("المصطلح الثاني", "term2") +
      field("المصطلح الثالث", "term3") +
      field("المصطلح / القيمة التي قادت تبصّري", "insightValue") +
      "</div>"
    );

    var srcHtml = "";
    for (var i = 0; i < 3; i++) {
      var s = p.sources[i];
      srcHtml +=
        '<div class="srcedit" data-src="' + i + '"><h3>المصدر ' + (i + 1) + "</h3><div class=\"grid2\">" +
        '<div class="formrow"><label>العنوان</label><input data-sk="title" value="' + esc(s.title) + '"></div>' +
        '<div class="formrow"><label>الكاتب</label><input data-sk="author" value="' + esc(s.author) + '"></div>' +
        '<div class="formrow"><label>الجهة</label><input data-sk="org" value="' + esc(s.org) + '"></div>' +
        '<div class="formrow"><label>السنة</label><input data-sk="year" value="' + esc(s.year) + '"></div>' +
        '<div class="formrow"><label>النوع</label><input data-sk="type" value="' + esc(s.type) + '" placeholder="كتاب / مقال / أرشيف / متحف…"></div>' +
        '<div class="formrow"><label>رقم الصفحة</label><input data-sk="page" value="' + esc(s.page) + '"></div>' +
        '<div class="formrow"><label>التصنيف المتوقَّع</label><select data-sk="expectedRating">' +
        ["", "عالٍ", "متوسّط", "منخفض"].map(function (opt) {
          return '<option ' + (s.expectedRating === opt ? "selected" : "") + ">" + opt + "</option>";
        }).join("") + "</select></div>" +
        "</div>" +
        '<div class="formrow"><label>لماذا موثوق؟</label><textarea rows="2" data-sk="whyTrust">' + esc(s.whyTrust) + "</textarea></div>" +
        '<div class="formrow"><label>لماذا ذو صلة؟</label><textarea rows="2" data-sk="whyRelevant">' + esc(s.whyRelevant) + "</textarea></div>" +
        "</div>";
    }
    var card3 = el('<div class="card"><h2><span class="num">3</span>المصادر الثلاثة</h2>' + srcHtml + "</div>");
    var saveBar = el('<div class="card" id="saveBar"><span class="tag green">محفوظ محلّيًّا على جهازك</span></div>');

    [card1, card2, card3, saveBar].forEach(function (c) { view.appendChild(c); });

    function persist() {
      var newP = { cluster: p.cluster, topic: p.topic, presentationName: p.presentationName, aspect: p.aspect, term1: p.term1, term2: p.term2, term3: p.term3, insightValue: p.insightValue, sources: p.sources };
      setProfile(newP);
      var bar = document.getElementById("saveBar");
      if (bar) bar.innerHTML = '<span class="tag green">تمّ الحفظ محلّيًّا — ' + new Date().toLocaleTimeString("ar") + "</span>";
    }

    view.querySelectorAll("[data-k]").forEach(function (f) {
      f.value = p[f.getAttribute("data-k")] || "";
      f.addEventListener("input", function () {
        p[f.getAttribute("data-k")] = f.value;
        persist();
      });
    });
    view.querySelectorAll("[data-src]").forEach(function (block) {
      var idx = +block.getAttribute("data-src");
      block.querySelectorAll("[data-sk]").forEach(function (f) {
        f.addEventListener("input", function () {
          p.sources[idx][f.getAttribute("data-sk")] = f.value;
          persist();
        });
        f.addEventListener("change", function () {
          p.sources[idx][f.getAttribute("data-sk")] = f.value;
          persist();
        });
      });
    });
  };

  // ================= الصفحة 5: ما وراء الكواليس =================
  VIEWS["bts"] = function (view) {
    var mode = getMode();
    var slides = getSlides();
    var selfChecks = getBtsChecks();
    var dragIdx = null;

    var wrap = el('<div class="stack"></div>');

    var checksHtml = DATA.bts.checks.map(function (c, i) {
      var on = !!selfChecks[i];
      return '<li class="' + (on ? "on" : "") + '"><label><input type="checkbox" data-chk="' + i + '" ' + (on ? "checked" : "") + "><span>" + esc(c) + "</span></label></li>";
    }).join("");
    wrap.appendChild(el('<div class="card"><h2><span class="num">1</span>قبل أن تُصدِّر — فحوص المئشار</h2><ul class="check">' + checksHtml + "</ul></div>"));

    var barEl = el('<div class="bar"><span id="barLabel"></span><span class="big" id="barTime"></span></div>');
    wrap.appendChild(barEl);

    var listCard = el('<div class="card"><h2><span class="num">2</span>' + esc(DATA.bts.title) + "</h2><div id=\"slideList\"></div>" +
      '<button class="btn ghost" id="addSlide" style="margin-top:10px">+ إضافة شريحة</button></div>');
    wrap.appendChild(listCard);

    var exportCard = el(
      '<div class="card"><h2><span class="num">3</span>تصدير الخطّة</h2>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button class="btn" id="expMd">تنزيل Markdown (.md)</button>' +
      '<button class="btn ghost" id="expCsv">تنزيل CSV (.csv)</button>' +
      "</div></div>"
    );
    wrap.appendChild(exportCard);
    view.appendChild(wrap);

    function fieldLabel(k) {
      var f = DATA.bts.fields.filter(function (x) { return x.k === k; })[0];
      return f ? f.label : k;
    }

    function renderSlides() {
      var listEl = document.getElementById("slideList");
      listEl.innerHTML = "";
      slides.forEach(function (sl, idx) {
        sl.n = idx + 1;
        var tLen = (sl.talk || "").length, sLen = (sl.show || "").length;
        var lenWarn = sLen > 0 && tLen > 0 && sLen > tLen;
        var visWarn = (sl.show || "").trim() && !(sl.visualSource || "").trim();
        var card = el(
          '<div class="slidecard" draggable="true" data-idx="' + idx + '">' +
          '<div class="shead"><span class="n">' + sl.n + '</span><span class="shandle">⠿</span>' +
          '<span style="flex:1"></span>' +
          '<button class="sdel" data-del="' + idx + '">حذف</button></div>' +
          '<div class="formrow"><label>' + esc(fieldLabel("goal")) + '</label><input data-f="goal" value="' + esc(sl.goal) + '"></div>' +
          '<div class="formrow"><label>' + esc(fieldLabel("talk")) + '</label><textarea rows="2" data-f="talk">' + esc(sl.talk) + "</textarea></div>" +
          '<div class="formrow"><label>' + esc(fieldLabel("show")) + '</label><textarea rows="2" data-f="show">' + esc(sl.show) + "</textarea></div>" +
          (lenWarn ? '<div class="warn">نصّ «ما سيظهر» أطول من «عمّا سأتكلّم» — المطلوب العكس.</div>' : "") +
          '<div class="formrow"><label>' + esc(fieldLabel("visualSource")) + '</label><input data-f="visualSource" value="' + esc(sl.visualSource) + '"></div>' +
          (visWarn ? '<div class="warn">هناك محتوى في «ما سيظهر» بلا مصدر مركّب بصريّ.</div>' : "") +
          '<div class="formrow"><label>' + esc(fieldLabel("terms")) + '</label><input data-f="terms" value="' + esc(sl.terms) + '"></div>' +
          '<div class="formrow"><label>' + esc(fieldLabel("sources")) + '</label><input data-f="sources" value="' + esc(sl.sources) + '"></div>' +
          (mode === "collaborative" ? '<div class="formrow"><label>' + esc(fieldLabel("owner")) + '</label><input data-f="owner" value="' + esc(sl.owner) + '"></div>' : "") +
          '<div class="formrow"><label>' + esc(fieldLabel("seconds")) + '</label><input type="number" min="0" data-f="seconds" value="' + sl.seconds + '"></div>' +
          "</div>"
        );
        listEl.appendChild(card);
      });
      bindSlideEvents();
      updateBar();
    }

    function updateBar() {
      var total = slides.reduce(function (a, s) { return a + (+s.seconds || 0); }, 0);
      var ok = total >= 360 && total <= 600;
      barEl.className = "bar" + (ok ? "" : " alert");
      document.getElementById("barLabel").textContent = ok ? "الزمن الإجماليّ ضمن 6-10 دقائق ✓" : "الزمن الإجماليّ خارج 6-10 دقائق!";
      document.getElementById("barTime").textContent = fmtTime(total);
    }

    function bindSlideEvents() {
      var listEl = document.getElementById("slideList");
      listEl.querySelectorAll("[data-f]").forEach(function (f) {
        var idx = +f.closest(".slidecard").getAttribute("data-idx");
        f.addEventListener("input", function () {
          var key = f.getAttribute("data-f");
          slides[idx][key] = key === "seconds" ? (+f.value || 0) : f.value;
          setSlides(slides);
          updateBar();
          if (key === "talk" || key === "show" || key === "visualSource") renderSlides();
        });
      });
      listEl.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          var idx = +b.getAttribute("data-del");
          if (slides.length <= 1) return;
          slides.splice(idx, 1);
          setSlides(slides);
          renderSlides();
        });
      });
      listEl.querySelectorAll(".slidecard").forEach(function (card) {
        card.addEventListener("dragstart", function () {
          dragIdx = +card.getAttribute("data-idx");
          card.classList.add("drag");
        });
        card.addEventListener("dragend", function () { card.classList.remove("drag"); });
        card.addEventListener("dragover", function (e) { e.preventDefault(); });
        card.addEventListener("drop", function (e) {
          e.preventDefault();
          var dropIdx = +card.getAttribute("data-idx");
          if (dragIdx === null || dragIdx === dropIdx) return;
          var moved = slides.splice(dragIdx, 1)[0];
          slides.splice(dropIdx, 0, moved);
          setSlides(slides);
          renderSlides();
        });
      });
    }

    renderSlides();

    document.getElementById("addSlide").addEventListener("click", function () {
      slides.push(emptySlide(slides.length + 1));
      setSlides(slides);
      renderSlides();
    });

    view.querySelectorAll("[data-chk]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        selfChecks[cb.getAttribute("data-chk")] = cb.checked;
        setBtsChecks(selfChecks);
        cb.closest("li").classList.toggle("on", cb.checked);
      });
    });

    document.getElementById("expMd").addEventListener("click", function () {
      var md = "# " + (getProfile().presentationName || "خطّة الشرائح") + "\n\n";
      slides.forEach(function (s) {
        md += "## شريحة " + s.n + "\n";
        md += "- هدف الشريحة: " + (s.goal || "—") + "\n";
        md += "- عمّا سيُتكلَّم: " + (s.talk || "—") + "\n";
        md += "- ما الذي سيظهر: " + (s.show || "—") + "\n";
        md += "- مصدر المركّب البصريّ: " + (s.visualSource || "—") + "\n";
        md += "- المصطلحات: " + (s.terms || "—") + "\n";
        md += "- المصادر: " + (s.sources || "—") + "\n";
        if (mode === "collaborative") md += "- من يقدّمها: " + (s.owner || "—") + "\n";
        md += "- الزمن المقدَّر: " + (s.seconds || 0) + " ثانية\n\n";
      });
      downloadText("ما-وراء-الكواليس.md", md, "text/markdown");
    });
    document.getElementById("expCsv").addEventListener("click", function () {
      var cols = ["n", "goal", "talk", "show", "visualSource", "terms", "sources", "owner", "seconds"];
      var rows = [cols.join(",")];
      slides.forEach(function (s) {
        rows.push(cols.map(function (c) {
          var v = String(s[c] == null ? "" : s[c]).replace(/"/g, '""');
          return '"' + v + '"';
        }).join(","));
      });
      downloadText("ما-وراء-الكواليس.csv", rows.join("\n"), "text/csv");
    });
  };

  // ================= الصفحة 6: الأوامر للبوت =================
  VIEWS["prompts"] = function (view) {
    var used = getPromptsUsed();
    var profile = getProfile();
    var groupKey = lsGet("promptGroup", "start");

    var tabsHtml = DATA.promptGroups.map(function (g) {
      return '<button data-g="' + g.k + '" aria-selected="' + (g.k === groupKey) + '">' + esc(g.label) + "</button>";
    }).join("");

    var group = DATA.promptGroups.filter(function (g) { return g.k === groupKey; })[0] || DATA.promptGroups[0];
    var promptsHtml = group.ids.map(function (id) {
      var p = DATA.prompts[id];
      var isUsed = !!used[id];
      return (
        '<div class="prompt ' + (isUsed ? "done" : "") + '" data-id="' + id + '">' +
        '<div class="head"><h3><b>' + id + ".</b>" + esc(p.t) + "</h3></div>" +
        '<div class="body">' + highlightFilled(p.x, profile) + "</div>" +
        '<div class="foot"><button class="copy" data-copy="' + id + '">نسخ الأمر</button>' +
        '<label><input type="checkbox" data-used="' + id + '" ' + (isUsed ? "checked" : "") + "> استعملته</label></div>" +
        "</div>"
      );
    }).join("");

    view.appendChild(el(
      '<div class="card"><h2><span class="num">6</span>الأوامر للبوت المرافق</h2>' +
      '<p class="stagenote">' + esc(group.note) + "</p>" +
      '<div class="stages" id="gTabs">' + tabsHtml + "</div>" +
      "</div>"
    ));
    view.appendChild(el('<div id="plist">' + promptsHtml + "</div>"));

    view.querySelectorAll("#gTabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        lsSet("promptGroup", b.getAttribute("data-g"));
        render();
      });
    });
    view.querySelectorAll("[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-copy");
        var filled = fillPlaceholders(DATA.prompts[id].x, profile);
        navigator.clipboard.writeText(filled).then(function () {
          b.textContent = "نُسخ ✓";
          b.classList.add("ok");
          setTimeout(function () { b.textContent = "نسخ الأمر"; b.classList.remove("ok"); }, 1600);
        }).catch(function () {});
      });
    });
    view.querySelectorAll("[data-used]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.getAttribute("data-used");
        used[id] = cb.checked;
        setPromptsUsed(used);
        cb.closest(".prompt").classList.toggle("done", cb.checked);
      });
    });
  };

  // ================= الصفحة 7: يوم العرض =================
  VIEWS["day"] = function (view) {
    var checks = getDayChecks();
    var items = DATA.dayChecklist;
    var doneCount = items.filter(function (_, i) { return checks[i]; }).length;
    var pct = Math.round((doneCount / items.length) * 100);

    var listHtml = items.map(function (c, i) {
      var on = !!checks[i];
      return '<li class="' + (on ? "on" : "") + '"><label><input type="checkbox" data-d="' + i + '" ' + (on ? "checked" : "") + "><span>" + esc(c) + "</span></label></li>";
    }).join("");

    var wrap = el(
      '<div class="stack">' +
      '<div class="card"><h2><span class="num">7</span>قائمة يوم العرض</h2>' +
      '<div class="progress"><i style="width:' + pct + '%"></i></div>' +
      '<div class="small muted">' + doneCount + " من " + items.length + "</div>" +
      '<ul class="check" style="margin-top:10px">' + listHtml + "</ul></div>" +

      '<div class="card"><h2><span class="num">8</span>مؤقّت بروفة</h2>' +
      '<p class="small muted">يعدّ تصاعديًّا؛ يصبح أخضر بين 6 و10 دقائق، وأحمر خارجها.</p>' +
      '<div class="timerbox"><div class="clock" id="clock">00:00</div>' +
      '<div class="acts"><button class="btn" id="tStart">ابدأ</button><button class="btn ghost" id="tPause">إيقاف مؤقّت</button><button class="btn ghost" id="tReset">تصفير</button></div>' +
      "</div></div>" +

      '<div class="warn">' + esc(DATA.task.presentation.recording) + "</div>" +
      "</div>"
    );
    view.appendChild(wrap);

    view.querySelectorAll("[data-d]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        checks[cb.getAttribute("data-d")] = cb.checked;
        setDayChecks(checks);
        cb.closest("li").classList.toggle("on", cb.checked);
        var bar = view.querySelector(".progress i");
        var newDone = items.filter(function (_, i) { return checks[i]; }).length;
        bar.style.width = Math.round((newDone / items.length) * 100) + "%";
        view.querySelector(".card .small.muted").textContent = newDone + " من " + items.length;
      });
    });

    var timerSec = 0, timerRunning = false, timerHandle = null;
    var clockEl = document.getElementById("clock");
    function tick() {
      timerSec++;
      clockEl.textContent = fmtTime(timerSec);
      clockEl.className = "clock " + (timerSec >= 360 && timerSec <= 600 ? "green" : "red");
    }
    document.getElementById("tStart").addEventListener("click", function () {
      if (timerRunning) return;
      timerRunning = true;
      timerHandle = setInterval(tick, 1000);
    });
    document.getElementById("tPause").addEventListener("click", function () {
      timerRunning = false;
      clearInterval(timerHandle);
    });
    document.getElementById("tReset").addEventListener("click", function () {
      timerRunning = false;
      clearInterval(timerHandle);
      timerSec = 0;
      clockEl.textContent = "00:00";
      clockEl.className = "clock";
    });
  };

  // ================= الصفحة 8: المردودية =================
  VIEWS["feedback"] = function (view) {
    var mode = getMode();
    var rub = DATA.rubric[mode];
    var item8 = rub.items.filter(function (it) { return it.n === 8; })[0];
    var subHtml = item8.items.map(function (pair) {
      return '<li><span class="p">' + pair[0] + "</span><span>" + esc(pair[1]) + "</span></li>";
    }).join("");

    var p22 = DATA.prompts[22], p23 = DATA.prompts[23];
    var profile = getProfile();

    view.appendChild(el(
      '<div class="stack">' +
      '<div class="card"><h2><span class="num">8</span>' + esc(item8.title) + " — " + item8.pts + " نقطة</h2>" +
      '<ul class="rubsub">' + subHtml + "</ul>" +
      '<div class="warn" style="margin-top:12px">' + esc(item8.warn) + "</div>" +
      "</div>" +

      '<div class="card"><h2><span class="num">تدريب</span>قبل المردودية</h2>' +
      '<div class="prompt"><div class="head"><h3><b>22.</b>' + esc(p22.t) + "</h3></div>" +
      '<div class="body">' + highlightFilled(p22.x, profile) + "</div>" +
      '<div class="foot"><button class="copy" data-copy="22">نسخ الأمر</button></div></div>' +

      '<div class="prompt" style="margin-top:12px"><div class="head"><h3><b>23.</b>' + esc(p23.t) + "</h3></div>" +
      '<div class="body">' + highlightFilled(p23.x, profile) + "</div>" +
      '<div class="foot"><button class="copy" data-copy="23">نسخ الأمر</button></div></div>' +
      "</div>" +
      "</div>"
    ));

    view.querySelectorAll("[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-copy");
        var filled = fillPlaceholders(DATA.prompts[id].x, profile);
        navigator.clipboard.writeText(filled).then(function () {
          b.textContent = "نُسخ ✓"; b.classList.add("ok");
          setTimeout(function () { b.textContent = "نسخ الأمر"; b.classList.remove("ok"); }, 1600);
        }).catch(function () {});
      });
    });
  };

  // ================= الصفحة 9: المعلّم =================
  VIEWS["teacher"] = function (view) {
    var ind = DATA.rubric.individual, col = DATA.rubric.collaborative;
    var rows = ind.items.map(function (iIt, idx) {
      var cIt = col.items[idx];
      return (
        "<tr><td>بند " + iIt.n + "</td><td>" + iIt.pts + " نقطة</td>" +
        '<td><span class="tag amber">' + esc(iIt.grade) + "</span></td>" +
        '<td><span class="tag ' + (cIt.grade === "تشاركيّ" ? "blue" : "amber") + '">' + esc(cIt.grade) + "</span></td></tr>"
      );
    }).join("");

    var unknownHtml = DATA.task.unknown.map(function (u) { return "<li>" + esc(u) + "</li>"; }).join("");

    view.appendChild(el(
      '<div class="stack">' +
      '<div class="card"><h2><span class="num">9</span>الفروق بين الشخصيّ والتشاركيّ — نوع العلامة لكلّ بند</h2>' +
      '<div class="tablewrap"><table><thead><tr><th>البند</th><th>النقاط</th><th>شخصيّ</th><th>تشاركيّ</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      "</div>" +

      '<div class="card"><h2>ما لا تقوله الوثائق — أسئلة للمرشدة</h2><ul>' + unknownHtml + "</ul></div>" +

      '<div class="card"><h2>قالب «ما وراء الكواليس» فارغ</h2>' +
      '<button class="btn" id="dlTemplate">تنزيل القالب (.csv)</button></div>' +
      "</div>"
    ));

    document.getElementById("dlTemplate").addEventListener("click", function () {
      var cols = DATA.bts.fields.map(function (f) { return f.k; });
      var header = DATA.bts.fields.map(function (f) { return f.label; });
      var rows = ["﻿" + header.join(",")];
      for (var i = 0; i < 8; i++) rows.push(cols.map(function () { return '""'; }).join(","));
      downloadText("قالب-ما-وراء-الكواليس-فارغ.csv", rows.join("\n"), "text/csv");
    });
  };

  // ---------- بدء التشغيل ----------
  window.addEventListener("hashchange", render);
  fetch("assets/data.json").then(function (r) { return r.json(); }).then(function (json) {
    DATA = json;
    if (!location.hash) location.hash = "#/";
    render();
  }).catch(function (e) {
    document.getElementById("view").innerHTML = '<div class="card err">تعذّر تحميل assets/data.json</div>';
  });
})();
