/*
  복리 계산 로직 (순수 함수, DOM 미접근).
  공식과 가정은 docs/CALCULATION.md 에 동일하게 문서화되어 있다.
*/
window.FructusCalculator = (function () {
  "use strict";

  var LIMITS = {
    PRINCIPAL_MAX: 1000000000000, // 1조원
    MONTHLY_MAX: 1000000000000, // 초기금액과 동일한 상한(오버플로 방지 목적, 문서 참고)
    PERIOD_MAX: { day: 36500, month: 1200, year: 100 },
    RATE_MIN: 0,
    RATE_MAX: 50,
  };

  var COMPOUND_M = { annual: 1, monthly: 12, daily: 365 };

  function isFiniteNumber(v) {
    return typeof v === "number" && isFinite(v);
  }

  /**
   * input = {
   *   principal: number, monthlyPayment: number,
   *   periodValue: number, periodUnit: 'day'|'month'|'year',
   *   annualRatePercent: number, compounding: 'annual'|'monthly'|'daily'
   * }
   * returns { valid: boolean, errors: { field: message } }
   */
  function validate(input) {
    var errors = {};

    if (!isFiniteNumber(input.principal) || input.principal < 0) {
      errors.principal = "0 이상의 숫자를 입력해 주세요.";
    } else if (input.principal > LIMITS.PRINCIPAL_MAX) {
      errors.principal = "초기 금액은 1조원을 넘을 수 없습니다.";
    }

    if (!isFiniteNumber(input.monthlyPayment) || input.monthlyPayment < 0) {
      errors.monthlyPayment = "0 이상의 숫자를 입력해 주세요.";
    } else if (input.monthlyPayment > LIMITS.MONTHLY_MAX) {
      errors.monthlyPayment = "월 적립액이 너무 큽니다.";
    }

    var unit = input.periodUnit;
    if (["day", "month", "year"].indexOf(unit) === -1) {
      errors.periodUnit = "기간 단위를 선택해 주세요.";
    } else if (!isFiniteNumber(input.periodValue) || input.periodValue <= 0) {
      errors.periodValue = "1 이상의 숫자를 입력해 주세요.";
    } else if (input.periodValue > LIMITS.PERIOD_MAX[unit]) {
      errors.periodValue =
        "최대 " + LIMITS.PERIOD_MAX[unit].toLocaleString("ko-KR") + (unit === "year" ? "년" : unit === "month" ? "개월" : "일") + "까지 입력할 수 있습니다.";
    }

    if (!isFiniteNumber(input.annualRatePercent)) {
      errors.annualRatePercent = "수익률을 입력해 주세요.";
    } else if (input.annualRatePercent < LIMITS.RATE_MIN || input.annualRatePercent > LIMITS.RATE_MAX) {
      errors.annualRatePercent = LIMITS.RATE_MIN + "% ~ " + LIMITS.RATE_MAX + "% 사이로 입력해 주세요.";
    }

    if (!COMPOUND_M.hasOwnProperty(input.compounding)) {
      errors.compounding = "복리 주기를 선택해 주세요.";
    }

    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /** 기간 단위를 연 단위(T)로 환산 */
  function toYears(periodValue, periodUnit) {
    if (periodUnit === "year") return periodValue;
    if (periodUnit === "month") return periodValue / 12;
    return periodValue / 365; // day
  }

  /** 월 실효이율: 선택한 복리 주기(m)의 연이율을 매월 적립금 계산용으로 환산 */
  function monthlyEffectiveRate(annualRate, m) {
    return Math.pow(1 + annualRate / m, m / 12) - 1;
  }

  /** 원금이 0..months 개월 후 갖는 미래가치 (m: 복리 횟수/년, annualRate: 소수) */
  function principalFutureValue(principal, annualRate, m, months) {
    var i = annualRate / m;
    var years = months / 12;
    return principal * Math.pow(1 + i, m * years);
  }

  /** 매월 말 적립(PMT)이 0..months 개월 후 갖는 미래가치 */
  function annuityFutureValue(pmt, iMonth, months) {
    if (iMonth === 0) return pmt * months;
    return (pmt * (Math.pow(1 + iMonth, months) - 1)) / iMonth;
  }

  function valueAtMonth(input, months, iMonth) {
    var fvPrincipal = principalFutureValue(input.principal, input.annualRatePercent / 100, COMPOUND_M[input.compounding], months);
    var fvAnnuity = annuityFutureValue(input.monthlyPayment, iMonth, months);
    var totalPrincipalPaid = input.principal + input.monthlyPayment * months;
    var finalValue = fvPrincipal + fvAnnuity;
    return {
      months: months,
      finalValue: finalValue,
      totalPrincipalPaid: totalPrincipalPaid,
      totalInterest: finalValue - totalPrincipalPaid,
    };
  }

  /**
   * 계산 실행. input은 validate()를 통과했다고 가정한다.
   * returns { summary, schedule, totalMonths }
   */
  function calculate(input) {
    var m = COMPOUND_M[input.compounding];
    var years = toYears(input.periodValue, input.periodUnit);
    var totalMonths = Math.max(1, Math.round(years * 12));
    var iMonth = monthlyEffectiveRate(input.annualRatePercent / 100, m);

    var summary = valueAtMonth(input, totalMonths, iMonth);
    summary.returnRatePercent =
      summary.totalPrincipalPaid > 0 ? (summary.totalInterest / summary.totalPrincipalPaid) * 100 : 0;

    var schedule = buildYearlySchedule(input, totalMonths, iMonth);

    return {
      totalMonths: totalMonths,
      summary: summary,
      schedule: schedule,
    };
  }

  /** 연차별 표/그래프용 데이터. 마지막이 12개월 미만이면 잔여 개월 행으로 별도 처리 */
  function buildYearlySchedule(input, totalMonths, iMonth) {
    var rows = [];
    var prevCumulativeInterest = 0;
    var fullYears = Math.floor(totalMonths / 12);
    var remainderMonths = totalMonths % 12;

    for (var y = 1; y <= fullYears; y++) {
      var months = y * 12;
      var v = valueAtMonth(input, months, iMonth);
      rows.push({
        label: y + "년차",
        months: months,
        cumulativePrincipal: v.totalPrincipalPaid,
        yearInterest: v.totalInterest - prevCumulativeInterest,
        cumulativeInterest: v.totalInterest,
        endValue: v.finalValue,
        isPartial: false,
      });
      prevCumulativeInterest = v.totalInterest;
    }

    if (remainderMonths > 0) {
      var v2 = valueAtMonth(input, totalMonths, iMonth);
      rows.push({
        label: fullYears + "년 " + remainderMonths + "개월",
        months: totalMonths,
        cumulativePrincipal: v2.totalPrincipalPaid,
        yearInterest: v2.totalInterest - prevCumulativeInterest,
        cumulativeInterest: v2.totalInterest,
        endValue: v2.finalValue,
        isPartial: true,
      });
    }

    return rows;
  }

  return {
    LIMITS: LIMITS,
    validate: validate,
    calculate: calculate,
    toYears: toYears,
  };
})();
