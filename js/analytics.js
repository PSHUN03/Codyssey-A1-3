/*
  자체 방문자 분석(보너스): 계산 실행 수 / AI 코치 사용 수 / 문의 제출 수를
  브라우저 localStorage에 누적 기록한다. 서버 저장 없이도 "어떤 기능이
  실제로 쓰이는가"를 관리자가 브라우저 콘솔에서 바로 확인할 수 있게 하기 위함.
*/
window.FructusAnalytics = (function () {
  "use strict";

  var STORAGE_KEY = "fructus-usage-metrics";
  var EVENTS = ["calculate", "ai_coach", "contact_submit"];

  function readAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : {};
      EVENTS.forEach(function (key) {
        if (typeof data[key] !== "number") data[key] = 0;
      });
      return data;
    } catch (err) {
      var fallback = {};
      EVENTS.forEach(function (key) {
        fallback[key] = 0;
      });
      return fallback;
    }
  }

  function track(eventName) {
    if (EVENTS.indexOf(eventName) === -1) return;
    var data = readAll();
    data[eventName] += 1;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      /* 저장소 불가 환경에서는 카운트를 생략한다 */
    }
  }

  function getSummary() {
    return readAll();
  }

  return { track: track, getSummary: getSummary };
})();
