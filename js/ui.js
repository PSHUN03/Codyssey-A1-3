/*
  index.html(홈/계산기) 페이지 전용 화면 로직.
  입력 검증 + 계산 실행 + 결과 카드/그래프/표 렌더링 + CSV 내보내기 + URL 공유를 담당한다.
  실제 복리 계산은 calculator.js, 그래프는 chart.js에 위임한다.
*/
window.FructusUI = (function () {
  "use strict";

  var Fmt = window.FructusFormat;
  var Calc = window.FructusCalculator;

  var form = document.querySelector("[data-calc-form]");
  if (!form) return {};

  var els = {
    principal: form.querySelector("#principal"),
    monthlyPayment: form.querySelector("#monthlyPayment"),
    periodValue: form.querySelector("#periodValue"),
    periodUnitButtons: form.querySelectorAll("[data-unit]"),
    annualRateRange: form.querySelector("#annualRateRange"),
    annualRateNumber: form.querySelector("#annualRateNumber"),
    compounding: form.querySelector("#compounding"),
    submitBtn: form.querySelector("[data-calc-submit]"),
  };

  var resultSection = document.querySelector("[data-result-section]");
  var chartContainer = document.querySelector("[data-chart-container]");
  var tableBody = document.querySelector("[data-table-body]");
  var csvBtn = document.querySelector("[data-csv-export]");

  var state = {
    periodUnit: "year",
    lastResult: null,
    lastInput: null,
  };

  var COMMA_FIELDS = ["principal", "monthlyPayment"];

  function parseAmount(el) {
    return Fmt.parseNumber(el.value);
  }

  function formatAmountField(el) {
    var num = parseAmount(el);
    if (isNaN(num)) return;
    el.value = Fmt.comma(num);
    var subEl = document.querySelector('[data-sub-display="' + el.id + '"]');
    if (subEl) subEl.textContent = Fmt.koreanUnit(num);
  }

  function collectInput() {
    return {
      principal: parseAmount(els.principal),
      monthlyPayment: parseAmount(els.monthlyPayment),
      periodValue: Fmt.parseNumber(els.periodValue.value),
      periodUnit: state.periodUnit,
      annualRatePercent: Fmt.parseNumber(els.annualRateNumber.value),
      compounding: els.compounding.value,
    };
  }

  function fieldEl(name) {
    return form.querySelector('[name="' + name + '"], #' + name);
  }

  function showFieldErrors(errors) {
    ["principal", "monthlyPayment", "periodValue", "annualRatePercent", "compounding"].forEach(function (name) {
      var input = fieldEl(name === "annualRatePercent" ? "annualRateNumber" : name);
      var errorEl = form.querySelector('[data-error-for="' + name + '"]');
      var message = errors[name];
      if (input) input.classList.toggle("is-invalid", Boolean(message));
      if (errorEl) {
        errorEl.textContent = message || "";
        errorEl.classList.toggle("is-visible", Boolean(message));
      }
    });
  }

  function animateCountUp(el, endValue, formatter, duration) {
    var startValue = 0;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = startValue + (endValue - startValue) * eased;
      el.textContent = formatter(current);
      if (progress < 1) requestAnimationFrame(step);
    }

    var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      el.textContent = formatter(endValue);
      return;
    }
    requestAnimationFrame(step);
  }

  function renderSummary(result) {
    var s = result.summary;
    animateCountUp(document.querySelector("[data-metric-final]"), s.finalValue, function (v) {
      return Fmt.comma(v) + "원";
    }, 900);
    animateCountUp(document.querySelector("[data-metric-principal]"), s.totalPrincipalPaid, function (v) {
      return Fmt.comma(v) + "원";
    }, 900);
    animateCountUp(document.querySelector("[data-metric-interest]"), s.totalInterest, function (v) {
      return Fmt.comma(v) + "원";
    }, 900);
    animateCountUp(document.querySelector("[data-metric-rate]"), s.returnRatePercent, function (v) {
      return v.toFixed(1) + "%";
    }, 900);

    document.querySelector("[data-metric-final-sub]").textContent = Fmt.koreanUnit(s.finalValue);

    renderComposition(s);
  }

  function renderComposition(s) {
    var principalPct = s.finalValue > 0 ? (s.totalPrincipalPaid / s.finalValue) * 100 : 0;
    var interestPct = s.finalValue > 0 ? (s.totalInterest / s.finalValue) * 100 : 0;

    var principalBar = document.querySelector("[data-composition-principal-bar]");
    var interestBar = document.querySelector("[data-composition-interest-bar]");
    principalBar.style.width = Fmt.clamp(principalPct, 0, 100).toFixed(1) + "%";
    interestBar.style.width = Fmt.clamp(interestPct, 0, 100).toFixed(1) + "%";

    document.querySelector("[data-composition-principal-pct]").textContent = principalPct.toFixed(1) + "%";
    document.querySelector("[data-composition-interest-pct]").textContent = interestPct.toFixed(1) + "%";

    var insight = document.querySelector("[data-composition-insight]");
    if (s.totalInterest <= 0) {
      insight.textContent = "이 조건에서는 발생하는 수익이 없어요. 기간이나 수익률을 조정해 보세요.";
    } else {
      insight.textContent =
        "최종 평가금액의 " + interestPct.toFixed(1) + "%는 수익으로 만들어졌어요.";
    }
  }

  function renderTable(schedule) {
    tableBody.innerHTML = schedule
      .map(function (row) {
        return (
          "<tr>" +
          "<td>" + row.label + "</td>" +
          "<td>" + Fmt.comma(row.cumulativePrincipal) + "원</td>" +
          '<td class="is-growth">' + Fmt.comma(row.yearInterest) + "원</td>" +
          "<td>" + Fmt.comma(row.cumulativeInterest) + "원</td>" +
          "<td>" + Fmt.comma(row.endValue) + "원</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderChart(input, schedule) {
    var points = [{ label: "시작", principal: input.principal, total: input.principal }];
    schedule.forEach(function (row) {
      points.push({ label: row.label, principal: row.cumulativePrincipal, total: row.endValue });
    });
    window.FructusChart.render(chartContainer, points);
  }

  function syncUrl(input) {
    if (!window.history || !window.history.replaceState) return;
    var params = new URLSearchParams();
    params.set("p", input.principal);
    params.set("m", input.monthlyPayment);
    params.set("n", input.periodValue);
    params.set("u", input.periodUnit);
    params.set("r", input.annualRatePercent);
    params.set("c", input.compounding);
    window.history.replaceState(null, "", "?" + params.toString());
  }

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    if (!params.has("p")) return null;
    return {
      principal: Number(params.get("p")),
      monthlyPayment: Number(params.get("m")),
      periodValue: Number(params.get("n")),
      periodUnit: params.get("u") || "year",
      annualRatePercent: Number(params.get("r")),
      compounding: params.get("c") || "annual",
    };
  }

  function applyInputToForm(input) {
    els.principal.value = Fmt.comma(input.principal);
    els.monthlyPayment.value = Fmt.comma(input.monthlyPayment);
    els.periodValue.value = input.periodValue;
    els.annualRateNumber.value = input.annualRatePercent;
    els.annualRateRange.value = input.annualRatePercent;
    els.compounding.value = input.compounding;
    setPeriodUnit(input.periodUnit);
  }

  function setPeriodUnit(unit) {
    state.periodUnit = unit;
    els.periodUnitButtons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-unit") === unit));
    });
  }

  function runCalculation(shouldSyncUrl) {
    var input = collectInput();
    var validation = Calc.validate(input);
    showFieldErrors(validation.errors);

    if (!validation.valid) {
      resultSection.setAttribute("data-empty", "true");
      return;
    }

    var result = Calc.calculate(input);
    state.lastResult = result;
    state.lastInput = input;

    resultSection.removeAttribute("data-empty");
    renderSummary(result);
    renderTable(result.schedule);
    renderChart(input, result.schedule);

    if (shouldSyncUrl !== false) syncUrl(input);
    if (window.FructusAnalytics) window.FructusAnalytics.track("calculate");
  }

  function exportCsv() {
    if (!state.lastResult) return;
    var rows = [["연차", "누적 납입 원금", "해당 연도 이자", "누적 이자", "연말 평가금액"]];
    state.lastResult.schedule.forEach(function (row) {
      rows.push([
        row.label,
        Math.round(row.cumulativePrincipal),
        Math.round(row.yearInterest),
        Math.round(row.cumulativeInterest),
        Math.round(row.endValue),
      ]);
    });
    var csv = rows.map(function (r) { return r.join(","); }).join("\r\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "fructus-복리계산결과.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function bindEvents() {
    COMMA_FIELDS.forEach(function (id) {
      els[id].addEventListener("blur", function () {
        formatAmountField(els[id]);
      });
    });

    form.querySelectorAll("[data-quick-add]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetEl = els[btn.getAttribute("data-target")];
        var current = parseAmount(targetEl) || 0;
        var add = Number(btn.getAttribute("data-quick-add"));
        targetEl.value = Fmt.comma(current + add);
        formatAmountField(targetEl);
      });
    });

    els.periodUnitButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setPeriodUnit(btn.getAttribute("data-unit"));
      });
    });

    els.annualRateRange.addEventListener("input", function () {
      els.annualRateNumber.value = els.annualRateRange.value;
    });
    els.annualRateNumber.addEventListener("input", function () {
      els.annualRateRange.value = els.annualRateNumber.value;
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      formatAmountField(els.principal);
      formatAmountField(els.monthlyPayment);
      runCalculation(true);
    });

    if (csvBtn) csvBtn.addEventListener("click", exportCsv);
  }

  function init() {
    bindEvents();
    var fromUrl = readUrl();
    if (fromUrl) {
      applyInputToForm(fromUrl);
    } else {
      formatAmountField(els.principal);
      formatAmountField(els.monthlyPayment);
    }
    runCalculation(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    getLastResult: function () {
      if (!state.lastResult || !state.lastInput) return null;
      var merged = {};
      for (var k in state.lastInput) merged[k] = state.lastInput[k];
      merged.summary = state.lastResult.summary;
      return merged;
    },
  };
})();
