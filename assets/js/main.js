/* ==========================================================================
   陕西百旺智税数字科技有限公司 — 官网交互脚本
   原生 JS，无依赖。所有模块在 DOMContentLoaded 后调用 boot() 挂载。
   面板定位统一使用 aria-controls（而非自定义选择器属性），
   避免选择器写错时静默失效。
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  var reduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. 页头：吸顶阴影 + 移动端抽屉 ---------- */
  function initHeader() {
    var header = $(".header");
    var toggle = $(".js-nav-toggle");
    var nav = $("#site-nav");

    if (header) {
      var onScroll = function () {
        if (window.scrollY > 8) header.classList.add("is-stuck");
        else header.classList.remove("is-stuck");
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    if (toggle && nav) {
      var setOpen = function (open) {
        document.body.classList.toggle("nav-open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
      };

      toggle.addEventListener("click", function () {
        setOpen(!document.body.classList.contains("nav-open"));
      });

      // 点击导航项后关闭
      $$(".nav-link", nav).forEach(function (a) {
        a.addEventListener("click", function () { setOpen(false); });
      });

      // Esc 关闭
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
          setOpen(false);
          toggle.focus();
        }
      });

      // 回到大屏时复位
      window.addEventListener("resize", function () {
        if (window.innerWidth > 1080) setOpen(false);
      });
    }
  }

  /* ---------- 2. 滚动进场动画 ---------- */
  function initReveal() {
    var items = $$(".reveal");
    if (!items.length) return;

    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-revealed"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        if (entry.target.hasAttribute("data-on-reveal")) {
          runCounters(entry.target);
        }
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 3. 数字滚动 ---------- */
  function runCounters(scope) {
    var targets = $$("[data-count]", scope);
    if (!targets.length) return;

    targets.forEach(function (el) {
      // 幂等保护：同一元素只跑一次
      if (el.dataset.counted === "1") return;
      el.dataset.counted = "1";

      var raw = el.getAttribute("data-count");
      var target = parseFloat(raw);
      if (isNaN(target)) { el.textContent = raw; return; }

      var decimals = (raw.split(".")[1] || "").length;
      var prefix = el.getAttribute("data-prefix") || "";
      var suffix = el.getAttribute("data-suffix") || "";

      var render = function (v) {
        el.textContent = prefix + v.toFixed(decimals) + suffix;
      };

      if (reduced) { render(target); return; }

      var duration = 1400;
      var start = null;
      var from = 0;

      var tick = function (ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        // easeOutCubic
        var eased = 1 - Math.pow(1 - p, 3);
        render(from + (target - from) * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* ---------- 4. 通用面板切换（身份选择器 / Tab / 分段） ----------
     依赖：按钮上写 aria-controls="面板 id"，
     可选 aria-selected 由脚本维护；面板加 .is-active。
     同时支持键盘左右方向键。                                    */
  function wireSwitchGroup(group, opts) {
    opts = opts || {};
    var btns = $$("[aria-controls]", group);
    if (!btns.length) return;

    var panels = btns.map(function (b) {
      return document.getElementById(b.getAttribute("aria-controls"));
    });

    var activate = function (index, focus) {
      btns.forEach(function (b, i) {
        var on = i === index;
        b.setAttribute("aria-selected", on ? "true" : "false");
        if (on) b.removeAttribute("tabindex");
        else b.setAttribute("tabindex", "-1");
        var p = panels[i];
        if (p) p.classList.toggle("is-active", on);
      });
      if (focus && btns[index]) btns[index].focus();
      if (typeof opts.onChange === "function") opts.onChange(index);
    };

    btns.forEach(function (b, i) {
      b.addEventListener("click", function () { activate(i, false); });
      b.addEventListener("keydown", function (e) {
        var last = btns.length - 1;
        var next = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          next = i === last ? 0 : i + 1;
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          next = i === 0 ? last : i - 1;
        } else if (e.key === "Home") {
          next = 0;
        } else if (e.key === "End") {
          next = last;
        }
        if (next !== null) { e.preventDefault(); activate(next, true); }
      });
    });

    // 初始态：无选中则默认第一项
    var hasActive = btns.some(function (b) {
      return b.getAttribute("aria-selected") === "true";
    });
    activate(hasActive ? btns.findIndex(function (b) {
      return b.getAttribute("aria-selected") === "true";
    }) : 0, false);
  }

  function initSwitchers() {
    $$("[data-switch]").forEach(function (group) {
      var kind = group.getAttribute("data-switch");
      var onChange = null;

      if (kind === "segment") {
        onChange = function () {
          // 身份切换后，若面板内有需要懒启动的数字动画，立即执行
          var active = $(".seg-panel.is-active", group.parentNode || document);
          if (active) runCounters(active);
        };
      }
      wireSwitchGroup(group, { onChange: onChange });
    });
  }

  /* ---------- 5. FAQ 手风琴 ---------- */
  function initFaq() {
    var items = $$(".faq-item");
    if (!items.length) return;

    items.forEach(function (item) {
      var btn = $(".faq-q", item);
      var panel = $(".faq-a", item);
      if (!btn || !panel) return;

      btn.addEventListener("click", function () {
        var open = !item.classList.contains("is-open");
        item.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });

    // 初始 aria 状态对齐
    items.forEach(function (item) {
      var btn = $(".faq-q", item);
      if (btn && !btn.hasAttribute("aria-expanded")) {
        btn.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- 6. 单选卡片：视觉选中态 ---------- */
  function initRadioCards() {
    var cards = $$(".radio-card");
    if (!cards.length) return;

    var sync = function () {
      cards.forEach(function (card) {
        var input = $("input", card);
        if (input) card.classList.toggle("is-checked", input.checked);
      });
    };
    cards.forEach(function (card) {
      var input = $("input", card);
      if (input) input.addEventListener("change", sync);
    });
    sync();
  }

  /* ---------- 7. 表单校验 ---------- */
  var RULES = {
    name: {
      test: function (v) { return v.length >= 2; },
      msg: "请填写真实姓名（至少 2 个字）"
    },
    phone: {
      test: function (v) { return /^1[3-9]\d{9}$/.test(v.replace(/[\s-]/g, "")); },
      msg: "请填写 11 位有效手机号"
    },
    email: {
      optional: true,
      test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); },
      msg: "邮箱格式不正确"
    },
    company: {
      optional: true,
      test: function (v) { return v.length >= 2; },
      msg: "请填写单位名称（至少 2 个字）"
    },
    city: {
      optional: true,
      test: function (v) { return v.length >= 2; },
      msg: "请填写所在城市"
    },
    message: {
      optional: true,
      test: function (v) { return v.length <= 600; },
      msg: "描述请控制在 600 字以内"
    }
  };

  function fieldError(input) {
    var field = input.closest(".field");
    return field ? $(".field-error", field) : null;
  }

  function validateInput(input) {
    var name = input.getAttribute("name");
    var rule = RULES[name];
    if (!rule) return true;

    var value = (input.value || "").trim();
    var errEl = fieldError(input);
    var ok = true;
    var msg = "";

    if (!value) {
      if (!rule.optional) { ok = false; msg = rule.msg; }
    } else if (!rule.test(value)) {
      ok = false;
      msg = rule.msg;
    }

    input.classList.toggle("is-error", !ok);
    input.setAttribute("aria-invalid", ok ? "false" : "true");
    if (errEl) errEl.textContent = ok ? "" : msg;
    return ok;
  }

  function validateGroup(form) {
    var ok = true;
    $$("input, select, textarea", form).forEach(function (el) {
      if (el.type === "radio" || el.type === "checkbox") return;
      if (el.hasAttribute("data-skip")) return;
      if (!validateInput(el)) ok = false;
    });

    // 必选单选组
    $$("[data-required-radio]", form).forEach(function (group) {
      var checked = $$("input[type=radio]", group).some(function (r) { return r.checked; });
      var errEl = $(".field-error", group.closest(".field") || group);
      if (!checked) {
        ok = false;
        if (errEl) errEl.textContent = "请选择一项";
      } else if (errEl) {
        errEl.textContent = "";
      }
    });

    // 必选复选框
    $$("input[type=checkbox][required]", form).forEach(function (cb) {
      var errEl = $(".field-error", cb.closest(".field") || cb.parentNode);
      if (!cb.checked) {
        ok = false;
        if (errEl) errEl.textContent = "请先勾选此项";
      } else if (errEl) {
        errEl.textContent = "";
      }
    });

    return ok;
  }

  function initForms() {
    $$("form[data-validate]").forEach(function (form) {
      var inputs = $$("input, select, textarea", form);

      inputs.forEach(function (el) {
        if (el.type === "radio" || el.type === "checkbox") return;
        // 失焦校验，输入时清错
        el.addEventListener("blur", function () { validateInput(el); });
        el.addEventListener("input", function () {
          if (el.classList.contains("is-error")) validateInput(el);
        });
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var ok = validateGroup(form);
        var status = $(".form-status", form);

        if (!ok) {
          if (status) {
            status.hidden = false;
            status.className = "form-status is-error";
            status.textContent = "表单还有未填写或格式不正确的内容，请检查标红的字段。";
          }
          var firstErr = $(".is-error", form);
          if (firstErr) {
            firstErr.focus();
            if (firstErr.scrollIntoView) {
              firstErr.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
            }
          }
          return;
        }

        if (status) {
          status.hidden = false;
          status.className = "form-status";
          status.textContent =
            "已收到你的预约信息。我们会在 1 个工作日内与你联系，确认需求与时间。" +
            "（演示站点：表单尚未接后端接口，提交内容不会真正发送。）";
        }
        form.reset();
        $$(".radio-card", form).forEach(function (c) { c.classList.remove("is-checked"); });
        syncFormLine(form);
      });

      // 复位时同步
      form.addEventListener("reset", function () {
        $$(".is-error", form).forEach(function (el) { el.classList.remove("is-error"); });
        $$(".field-error", form).forEach(function (el) { el.textContent = ""; });
        var status = $(".form-status", form);
        if (status) status.hidden = true;
      });
    });
  }

  /* ---------- 8. 联系页：按业务线切换扩展字段 + 提交按钮文案 ---------- */
  function syncFormLine(form) {
    var picked = $$("input[name='line']", form).filter(function (r) { return r.checked; });
    if (!picked.length) return;
    var line = picked[0].value;

    $$("[data-when]", form).forEach(function (el) {
      var when = el.getAttribute("data-when");
      var show = when === line;
      el.hidden = !show;
      // 隐藏的字段不参与校验
      $$("input, select, textarea", el).forEach(function (f) {
        if (show) f.removeAttribute("data-skip");
        else f.setAttribute("data-skip", "1");
      });
    });

    var submit = $("[data-submit-label]", form);
    if (submit) {
      var map = {
        it: "预约财税信息化诊断",
        agency: "预约代理记账评估",
        both: "提交需求，由顾问分流"
      };
      submit.textContent = map[line] || submit.textContent;
    }

    var hint = $("[data-line-hint]", form);
    if (hint) {
      var hints = {
        it: "已选择「财税信息化」：请补充需要对接的系统，便于我们预判技术工作量。",
        agency: "已选择「财税代理与合规」：请补充纳税人类型与月票据量，便于我们给出准确报价。",
        both: "已勾选两条业务线：我们会安排两位顾问分别对接，再合并成一份方案。"
      };
      hint.textContent = hints[line] || "";
    }
  }

  function initFormLine() {
    var form = $("form[data-line-form]");
    if (!form) return;
    $$("input[name='line']", form).forEach(function (radio) {
      radio.addEventListener("change", function () { syncFormLine(form); });
    });
    syncFormLine(form);
  }

  /* ---------- 9. 返回顶部 ---------- */
  function initToTop() {
    var btn = $(".to-top");
    if (!btn) return;

    var onScroll = function () {
      btn.classList.toggle("is-show", window.scrollY > 520);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    btn.addEventListener("click", function () {
      window.scrollTo({
        top: 0,
        behavior: reduced ? "auto" : "smooth"
      });
    });
  }

  /* ---------- 10. 锚点平滑滚动（带吸顶偏移） ---------- */
  function initAnchorScroll() {
    document.addEventListener("click", function (e) {
      var link = e.target.closest && e.target.closest('a[href^="#"]');
      if (!link) return;
      var hash = link.getAttribute("href");
      if (!hash || hash === "#" || hash.length < 2) return;

      var target = document.getElementById(hash.slice(1));
      if (!target) return;

      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY -
        (parseInt(getComputedStyle(document.documentElement)
          .getPropertyValue("--header-h"), 10) || 76) - 12;

      window.scrollTo({ top: top, behavior: reduced ? "auto" : "smooth" });
      if (history.replaceState) history.replaceState(null, "", hash);
    });
  }

  /* ---------- 11. 移动端表格提示（横滑可查看） ---------- */
  function initTableHint() {
    $$(".table-wrap").forEach(function (wrap) {
      var table = $("table", wrap);
      if (!table) return;
      if (table.scrollWidth > wrap.clientWidth + 4) {
        wrap.setAttribute("tabindex", "0");
        wrap.setAttribute("role", "region");
        wrap.setAttribute("aria-label", "可横向滚动的表格");
      }
    });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    initHeader();
    initSwitchers();
    initFaq();
    initRadioCards();
    initForms();
    initFormLine();
    initToTop();
    initAnchorScroll();
    initReveal();
    initTableHint();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
