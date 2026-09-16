
/* ==========================================================================
   陕西百旺数字科技有限公司 — 站点交互脚本
   无外部依赖，纯原生实现
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (sel, ctx) {
    return (ctx || document).querySelector(sel);
  };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. 顶部导航：滚动阴影 + 移动端抽屉 ---------- */
  function initHeader() {
    var header = $(".site-header");
    var toggle = $(".nav-toggle");
    var nav = $(".nav");

    if (header) {
      var onScroll = function () {
        header.classList.toggle("is-stuck", window.scrollY > 8);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    if (!toggle || !nav) return;

    var close = function () {
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // 点击遮罩或导航项后收起（移动端抽屉）
    document.addEventListener("click", function (e) {
      if (!document.body.classList.contains("nav-open")) return;
      if (e.target.closest && e.target.closest(".nav-scrim")) close();
      if (e.target.closest && e.target.closest(".nav a")) close();
    });

    // Esc 关闭
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    // 视口拉宽回桌面尺寸时复位
    window.addEventListener("resize", function () {
      if (window.innerWidth > 980) close();
    });
  }

  /* ---------- 2. 数字滚动 ---------- */
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateNumber(el) {
    if (el.dataset.counted === "1") return;
    el.dataset.counted = "1";

    var target = parseFloat(el.getAttribute("data-count"));
    if (isNaN(target)) return;

    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";

    var render = function (v) {
      var s = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString();
      // 千分位
      if (decimals === 0 && target >= 10000) {
        s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      }
      el.textContent = prefix + s + suffix;
    };

    if (reduceMotion) {
      render(target);
      return;
    }

    var duration = 1400;
    var start = null;

    var tick = function (ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      render(target * easeOutCubic(p));
      if (p < 1) window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  }

  /* ---------- 3. 进度条 / 数据动画（幂等） ---------- */
  function runDataAnimations(scope) {
    var root = scope || document;

    $$("[data-count]", root).forEach(animateNumber);

    $$("[data-bar]", root).forEach(function (el) {
      if (el.dataset.barred === "1") return;
      el.dataset.barred = "1";
      var pct = parseFloat(el.getAttribute("data-bar")) || 0;
      if (reduceMotion) {
        el.style.width = pct + "%";
        return;
      }
      window.requestAnimationFrame(function () {
        el.style.width = pct + "%";
      });
    });
  }

  /* ---------- 4. 滚动进场动画 ---------- */
  function initReveal() {
    var items = $$(".reveal");

    if (!items.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-revealed");
        runDataAnimations(el);
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          // 每个进场容器内的数据动画统一触发（函数内部幂等）
          runDataAnimations(entry.target);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    items.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ---------- 5. Tab 切换 ---------- */
  function initTabs() {
    $$("[data-tabs]").forEach(function (group) {
      var tabs = $$(".tab", group);
      if (!tabs.length) return;

      var panelsSel = group.getAttribute("data-tabs");
      var panels = panelsSel ? $$(panelsSel) : [];

      // 兜底：选择器若误指向外层容器，退回到组内的 .tab-panel，
      // 避免「面板数量与标签数量不符」导致切换静默失效
      if (panels.length !== tabs.length) {
        var inner = $$(".tab-panel", group);
        if (inner.length === tabs.length) panels = inner;
      }

      function select(index, focus) {
        tabs.forEach(function (t, i) {
          var on = i === index;
          t.setAttribute("aria-selected", on ? "true" : "false");
          t.setAttribute("tabindex", on ? "0" : "-1");
        });
        panels.forEach(function (p, i) {
          if (i === index) {
            p.removeAttribute("hidden");
            runDataAnimations(p);
          } else {
            p.setAttribute("hidden", "");
          }
        });
        if (focus && tabs[index]) tabs[index].focus();
      }

      tabs.forEach(function (tab, i) {
        tab.addEventListener("click", function () {
          select(i, false);
        });
        tab.addEventListener("keydown", function (e) {
          var next = null;
          if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
          else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
          else if (e.key === "Home") next = 0;
          else if (e.key === "End") next = tabs.length - 1;
          if (next === null) return;
          e.preventDefault();
          select(next, true);
        });
      });

      // 初始态：以 aria-selected 为准，缺省选中第一个
      var current = tabs.findIndex(function (t) {
        return t.getAttribute("aria-selected") === "true";
      });
      select(current < 0 ? 0 : current, false);
    });
  }

  /* ---------- 6. FAQ 手风琴 ---------- */
  function initFaq() {
    $$(".faq").forEach(function (faq) {
      var items = $$(".faq-item", faq);

      items.forEach(function (item) {
        var btn = $(".faq-q", item);
        if (!btn) return;
        var open = item.classList.contains("is-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");

        btn.addEventListener("click", function () {
          var willOpen = !item.classList.contains("is-open");

          // 单开模式：同一组内只保留一个展开
          items.forEach(function (other) {
            if (other === item) return;
            other.classList.remove("is-open");
            var ob = $(".faq-q", other);
            if (ob) ob.setAttribute("aria-expanded", "false");
          });

          item.classList.toggle("is-open", willOpen);
          btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
        });
      });
    });
  }

  /* ---------- 7. 表单校验 ---------- */
  function initForms() {
    var phoneRe = /^1[3-9]\d{9}$/;
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    $$("form[data-validate]").forEach(function (form) {
      var status = $(".form-status", form);

      function fieldOf(input) {
        return input.closest(".field") || input.closest(".checkbox-row");
      }

      function setError(input, msg) {
        var wrap = fieldOf(input);
        if (!wrap) return;
        var box = $(".field-error", wrap);
        if (msg) {
          wrap.classList.add("has-error");
          if (box) box.textContent = msg;
        } else {
          wrap.classList.remove("has-error");
        }
      }

      function validate(input) {
        var val = (input.value || "").trim();
        var type = input.getAttribute("data-rule") || input.type;

        if (input.type === "checkbox") {
          if (input.required && !input.checked) {
            setError(input, "请先勾选该项");
            return false;
          }
          setError(input, "");
          return true;
        }

        if (input.required && !val) {
          setError(input, "此项为必填");
          return false;
        }

        if (val && type === "phone" && !phoneRe.test(val)) {
          setError(input, "请输入 11 位有效手机号");
          return false;
        }

        if (val && type === "email" && !emailRe.test(val)) {
          setError(input, "邮箱格式不正确");
          return false;
        }

        var min = parseInt(input.getAttribute("minlength") || "0", 10);
        if (val && min && val.length < min) {
          setError(input, "至少填写 " + min + " 个字");
          return false;
        }

        setError(input, "");
        return true;
      }

      var fields = $$("input, select, textarea", form);

      fields.forEach(function (input) {
        input.addEventListener("blur", function () {
          validate(input);
        });
        input.addEventListener("input", function () {
          if (fieldOf(input) && fieldOf(input).classList.contains("has-error")) {
            validate(input);
          }
        });
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();

        var bad = null;
        fields.forEach(function (input) {
          if (!validate(input) && !bad) bad = input;
        });

        if (bad) {
          if (status) {
            status.className = "form-status err show";
            status.innerHTML =
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>' +
              "<span>还有必填项未完成，请检查标红的字段后重新提交。</span>";
            status.scrollIntoView({
              behavior: reduceMotion ? "auto" : "smooth",
              block: "center",
            });
          }
          if (bad.focus) bad.focus();
          return;
        }

        // 静态站点无后端：此处仅为前端演示，真实提交需对接接口
        if (status) {
          status.className = "form-status ok show";
          status.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>' +
            "<span><strong>已收到您的信息。</strong>本站为静态演示站点，表单未接入后端接口；正式上线时把提交逻辑指向你们的 CRM 或企业微信即可。</span>";
          status.scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "center",
          });
        }
        form.reset();
        fields.forEach(function (input) {
          setError(input, "");
        });
      });
    });
  }

  /* ---------- 8. 返回顶部 ---------- */
  function initToTop() {
    var btn = $(".to-top");
    if (!btn) return;

    var onScroll = function () {
      btn.classList.toggle("show", window.scrollY > 620);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  /* ---------- 9. 政策节点倒计时 ---------- */
  function initCountdown() {
    var bars = $$("[data-deadline]");
    if (!bars.length) return;

    bars.forEach(function (bar) {
      var target = new Date(bar.getAttribute("data-deadline"));
      if (isNaN(target.getTime())) return;

      var dEl = $('[data-cd="d"]', bar);
      var hEl = $('[data-cd="h"]', bar);
      var mEl = $('[data-cd="m"]', bar);
      var sEl = $('[data-cd="s"]', bar);
      var textEl = $(".deadline-text", bar);

      var pad = function (n) {
        return (n < 10 ? "0" : "") + n;
      };

      var timer = null;

      var update = function () {
        var diff = target.getTime() - Date.now();

        if (diff <= 0) {
          if (dEl) dEl.textContent = "0";
          if (hEl) hEl.textContent = "00";
          if (mEl) mEl.textContent = "00";
          if (sEl) sEl.textContent = "00";
          if (textEl) {
            textEl.innerHTML =
              "国家税务总局公告 2026 年第 11 号已正式生效：全国成品油零售加油站已全面实施「交易即开票」。<strong>尚未完成系统改造与乐企平台对接的企业，仍可申请整改支持。</strong>";
          }
          bar.classList.add("is-expired");
          if (timer) {
            window.clearInterval(timer);
            timer = null;
          }
          return;
        }

        var totalSec = Math.floor(diff / 1000);
        var days = Math.floor(totalSec / 86400);
        var hours = Math.floor((totalSec % 86400) / 3600);
        var mins = Math.floor((totalSec % 3600) / 60);
        var secs = totalSec % 60;

        if (dEl) dEl.textContent = String(days);
        if (hEl) hEl.textContent = pad(hours);
        if (mEl) mEl.textContent = pad(mins);
        if (sEl) sEl.textContent = pad(secs);
      };

      update();
      timer = window.setInterval(update, 1000);
    });
  }

  /* ---------- 10. 首屏开票流水线演示 ---------- */
  function initFlowDemo() {
    var lists = $$("[data-flow-demo]");
    if (!lists.length) return;

    lists.forEach(function (list) {
      var steps = $$(".flow-step", list);
      if (!steps.length) return;

      if (reduceMotion) {
        steps.forEach(function (s) {
          s.classList.add("is-done");
        });
        return;
      }

      var i = 0;
      var reset = function () {
        steps.forEach(function (s) {
          s.classList.remove("is-done", "is-active");
        });
      };

      reset();

      window.setInterval(function () {
        if (i >= steps.length) {
          reset();
          i = 0;
          return;
        }
        steps[i].classList.add("is-done");
        i += 1;
      }, 1500);
    });
  }

  /* ---------- 11. 页脚年份 & 当前页高亮 ---------- */
  function initMisc() {
    $$("[data-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });

    var path = location.pathname.split("/").pop() || "index.html";
    if (path === "") path = "index.html";

    $$(".nav a").forEach(function (a) {
      var href = a.getAttribute("href");
      if (!href) return;
      if (href === path) a.classList.add("is-active");
    });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    initHeader();
    initMisc();
    initCountdown();
    initTabs();
    initFaq();
    initForms();
    initToTop();
    initFlowDemo();
    initReveal();

    // 首屏若已在视口内，立即补齐数据动画
    window.setTimeout(function () {
      $$("[data-on-reveal]").forEach(runDataAnimations);
    }, 140);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
