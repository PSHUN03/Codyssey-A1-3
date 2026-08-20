/*
  숫자 포맷 유틸리티 (원화 KRW 기준).
  계산기, 결과 카드, 차트, 표, learn 페이지 예시 등에서 공통으로 사용한다.
*/
window.FructusFormat = (function () {
  "use strict";

  function roundWon(value) {
    return Math.round(value);
  }

  /** 1234567 -> "1,234,567" */
  function comma(value) {
    var rounded = roundWon(value);
    return rounded.toLocaleString("ko-KR");
  }

  /** 120000000 -> "1억 2,000만원" 보조 표기. 1만원 미만이면 "원"만 표기 */
  function koreanUnit(value) {
    var rounded = roundWon(value);
    var sign = rounded < 0 ? "-" : "";
    var amount = Math.abs(rounded);

    var eok = Math.floor(amount / 100000000);
    var man = Math.floor((amount % 100000000) / 10000);

    var parts = [];
    if (eok > 0) parts.push(eok.toLocaleString("ko-KR") + "억");
    if (man > 0) parts.push(man.toLocaleString("ko-KR") + "만");

    if (parts.length === 0) {
      return sign + amount.toLocaleString("ko-KR") + "원";
    }
    return sign + parts.join(" ") + "원";
  }

  /** "1,234,567" | "1234567원" 등 사용자 입력을 숫자로. 비숫자면 NaN */
  function parseNumber(str) {
    if (typeof str === "number") return str;
    if (!str) return NaN;
    var cleaned = String(str).replace(/[,원\s]/g, "");
    if (cleaned === "" || cleaned === "-") return NaN;
    return Number(cleaned);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /** 0.0512 -> "5.12%" (percent 값 그대로: 5.12 -> "5.12%") */
  function percent(value, digits) {
    var d = typeof digits === "number" ? digits : 2;
    return value.toFixed(d) + "%";
  }

  return {
    roundWon: roundWon,
    comma: comma,
    koreanUnit: koreanUnit,
    parseNumber: parseNumber,
    clamp: clamp,
    percent: percent,
  };
})();
