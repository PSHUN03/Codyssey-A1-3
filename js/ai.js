/*
  AI 투자 코치: /api/coach 호출 및 3종 실패 처리(빈 입력 / API 오류 / 지연·타임아웃)
  계산 로직과 분리된 별도 파일로 두어 AI 연동 부분만 독립적으로 교체/디버깅할 수 있게 한다.
*/
(function () {
  "use strict";

  var MAX_GOAL_LENGTH = 300;
  var COOLDOWN_MS = 10000;
  var TIMEOUT_MS = 25000;

  var form = document.querySelector("[data-ai-form]");
  if (!form) return;

  var goalInput = form.querySelector("[data-ai-goal]");
  var counter = form.querySelector("[data-ai-counter]");
  var submitBtn = form.querySelector("[data-ai-submit]");
  var errorBox = document.querySelector("[data-ai-error]");
  var loadingBox = document.querySelector("[data-ai-loading]");
  var elapsedEl = document.querySelector("[data-ai-elapsed]");
  var resultBox = document.querySelector("[data-ai-result]");
  var retryBtn = document.querySelector("[data-ai-retry]");
  var emptyState = document.querySelector("[data-ai-empty]");

  var elapsedTimer = null;
  var cooldownTimer = null;
  var lastPayload = null;

  function getContext() {
    var raw = window.FructusUI && window.FructusUI.getLastResult ? window.FructusUI.getLastResult() : null;
    return raw;
  }

  function updateCounter() {
    var len = goalInput.value.length;
    counter.textContent = len + " / " + MAX_GOAL_LENGTH;
    counter.classList.toggle("is-over", len > MAX_GOAL_LENGTH);
  }

  function showError(message) {
    errorBox.innerHTML =
      '<div class="alert alert-error" role="alert">' +
      '<span aria-hidden="true">⚠</span><span>' +
      message +
      "</span></div>";
    errorBox.hidden = false;
    retryBtn.hidden = false;
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.innerHTML = "";
    retryBtn.hidden = true;
  }

  function setLoading(isLoading) {
    submitBtn.setAttribute("data-loading", String(isLoading));
    submitBtn.disabled = isLoading;
    loadingBox.hidden = !isLoading;

    if (isLoading) {
      var start = Date.now();
      elapsedEl.textContent = "0초 경과";
      elapsedTimer = setInterval(function () {
        elapsedEl.textContent = Math.floor((Date.now() - start) / 1000) + "초 경과";
      }, 1000);
    } else if (elapsedTimer) {
      clearInterval(elapsedTimer);
      elapsedTimer = null;
    }
  }

  function startCooldown() {
    var remaining = Math.ceil(COOLDOWN_MS / 1000);
    submitBtn.disabled = true;
    var label = submitBtn.querySelector(".btn-label");

    cooldownTimer = setInterval(function () {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        submitBtn.disabled = false;
        label.textContent = "AI 코치에게 물어보기";
      } else {
        label.textContent = remaining + "초 후 다시 시도";
      }
    }, 1000);
  }

  function renderResult(data) {
    resultBox.hidden = false;
    resultBox.innerHTML =
      '<div class="ai-result-grid">' +
      '<div class="card ai-result-card"><h4>목표 달성 가능성</h4><p>' +
      escapeHtml(data.diagnosis) +
      "</p></div>" +
      '<div class="card ai-result-card"><h4>부족분 해석</h4><p>' +
      escapeHtml(data.gap) +
      "</p></div>" +
      '<div class="card ai-result-card"><h4>실행 가능한 조언</h4><ol class="ai-action-list">' +
      data.actions.map(function (a) {
        return "<li>" + escapeHtml(a) + "</li>";
      }).join("") +
      "</ol></div>" +
      '<div class="alert alert-muted"><span aria-hidden="true">💡</span><span>' +
      escapeHtml(data.caution) +
      "</span></div>" +
      "</div>";
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = String(str == null ? "" : str);
    return div.innerHTML;
  }

  function statusMessage(status) {
    if (status === 429) return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
    if (status >= 500) return "일시적인 오류입니다. 잠시 후 다시 시도해 주세요.";
    if (status === 400) return "입력값을 확인해 주세요.";
    if (status >= 400) return "요청을 처리할 수 없습니다.";
    return "알 수 없는 오류가 발생했습니다.";
  }

  function submit() {
    var goal = goalInput.value.trim();

    if (emptyState) emptyState.hidden = true;

    if (!goal) {
      showError("목표를 한 줄이라도 입력해 주세요.");
      goalInput.focus();
      return;
    }
    if (goal.length > MAX_GOAL_LENGTH) {
      showError("목표 설명은 " + MAX_GOAL_LENGTH + "자 이내로 입력해 주세요.");
      return;
    }

    var context = getContext();
    if (!context) {
      showError("먼저 위에서 복리 계산을 실행해 주세요.");
      return;
    }

    clearError();
    resultBox.hidden = true;
    setLoading(true);

    var payload = {
      goalText: goal,
      principal: context.principal,
      monthlyPayment: context.monthlyPayment,
      periodValue: context.periodValue,
      periodUnit: context.periodUnit,
      annualRatePercent: context.annualRatePercent,
      compounding: context.compounding,
      finalValue: context.summary.finalValue,
      totalPrincipalPaid: context.summary.totalPrincipalPaid,
      totalInterest: context.summary.totalInterest,
      returnRatePercent: context.summary.returnRatePercent,
    };
    lastPayload = payload;

    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
      controller.abort();
    }, TIMEOUT_MS);

    fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(function (res) {
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw { kind: "http", status: res.status };
        }
        return res.json();
      })
      .then(function (data) {
        setLoading(false);
        renderResult(data);
        startCooldown();
        if (window.FructusAnalytics) window.FructusAnalytics.track("ai_coach");
      })
      .catch(function (err) {
        clearTimeout(timeoutId);
        setLoading(false);
        startCooldown();
        if (err && err.name === "AbortError") {
          showError("응답이 지연되고 있어요. 다시 시도해 주세요.");
        } else if (err && err.kind === "http") {
          showError(statusMessage(err.status));
        } else {
          showError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
        }
      });
  }

  goalInput.addEventListener("input", updateCounter);
  updateCounter();

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    submit();
  });

  retryBtn.addEventListener("click", function () {
    clearError();
    submit();
  });
})();
