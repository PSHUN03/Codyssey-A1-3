/* 문의하기 폼: 검증 후 /api/contact 로 전송 (보너스: Discord 웹훅 연동) */
(function () {
  "use strict";

  var form = document.querySelector("[data-contact-form]");
  if (!form) return;

  var statusBox = document.querySelector("[data-contact-status]");
  var submitBtn = form.querySelector("[data-contact-submit]");

  var nameEl = form.querySelector("#contact-name");
  var emailEl = form.querySelector("#contact-email");
  var typeEl = form.querySelector("#contact-type");
  var messageEl = form.querySelector("#contact-message");

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function fieldError(el, message) {
    var box = form.querySelector('[data-error-for="' + el.id + '"]');
    el.classList.toggle("is-invalid", Boolean(message));
    if (box) {
      box.textContent = message || "";
      box.classList.toggle("is-visible", Boolean(message));
    }
    return !message;
  }

  function validate() {
    var ok = true;
    if (!nameEl.value.trim()) ok = fieldError(nameEl, "이름을 입력해 주세요.") && ok;
    else fieldError(nameEl, "");

    if (!EMAIL_RE.test(emailEl.value.trim())) ok = fieldError(emailEl, "올바른 이메일 형식을 입력해 주세요.") && ok;
    else fieldError(emailEl, "");

    var msg = messageEl.value.trim();
    if (!msg) ok = fieldError(messageEl, "문의 내용을 입력해 주세요.") && ok;
    else if (msg.length > 1000) ok = fieldError(messageEl, "문의 내용은 1000자 이내로 입력해 주세요.") && ok;
    else fieldError(messageEl, "");

    return ok;
  }

  function setStatus(type, message) {
    if (!message) {
      statusBox.hidden = true;
      statusBox.innerHTML = "";
      return;
    }
    statusBox.hidden = false;
    var cls = type === "error" ? "alert-error" : "alert-success";
    statusBox.innerHTML = '<div class="alert ' + cls + '" role="status">' + message + "</div>";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    setStatus(null);

    if (!validate()) return;

    submitBtn.disabled = true;
    submitBtn.setAttribute("data-loading", "true");

    fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nameEl.value.trim(),
        email: emailEl.value.trim(),
        type: typeEl.value,
        message: messageEl.value.trim(),
      }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("http-" + res.status);
        return res.json();
      })
      .then(function () {
        setStatus("success", "문의가 접수되었습니다. 빠르게 확인 후 답변드리겠습니다.");
        form.reset();
        if (window.FructusAnalytics) window.FructusAnalytics.track("contact_submit");
      })
      .catch(function () {
        setStatus("error", "일시적인 오류로 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.setAttribute("data-loading", "false");
      });
  });
})();
