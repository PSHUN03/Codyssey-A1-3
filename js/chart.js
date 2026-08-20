/*
  누적 원금 vs 최종 평가금액을 보여주는 반응형 SVG 영역 차트.
  외부 차트 라이브러리 없이 순수 SVG + JS로 그린다.
*/
window.FructusChart = (function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var W = 960;
  var H = 380;
  var PAD = { top: 24, right: 20, bottom: 32, left: 12 };

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    for (var key in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, key)) {
        el.setAttribute(key, attrs[key]);
      }
    }
    return el;
  }

  function buildScales(points) {
    var maxTotal = 0;
    points.forEach(function (p) {
      if (p.total > maxTotal) maxTotal = p.total;
    });
    if (maxTotal <= 0) maxTotal = 1;
    var yMax = maxTotal * 1.12;

    var innerW = W - PAD.left - PAD.right;
    var innerH = H - PAD.top - PAD.bottom;
    var n = points.length - 1 || 1;

    return {
      x: function (i) {
        return PAD.left + (innerW * i) / n;
      },
      y: function (v) {
        return PAD.top + innerH - (innerH * v) / yMax;
      },
      yMax: yMax,
      baseline: PAD.top + innerH,
    };
  }

  function pathFor(points, scale, key) {
    return points
      .map(function (p, i) {
        var cmd = i === 0 ? "M" : "L";
        return cmd + scale.x(i).toFixed(1) + "," + scale.y(p[key]).toFixed(1);
      })
      .join(" ");
  }

  function areaFor(points, scale, key) {
    var line = pathFor(points, scale, key);
    var last = points.length - 1;
    return (
      line +
      " L" +
      scale.x(last).toFixed(1) +
      "," +
      scale.baseline.toFixed(1) +
      " L" +
      scale.x(0).toFixed(1) +
      "," +
      scale.baseline.toFixed(1) +
      " Z"
    );
  }

  function gridLines(scale, svg) {
    var steps = 4;
    for (var i = 0; i <= steps; i++) {
      var value = (scale.yMax / steps) * i;
      var y = scale.y(value);
      svg.appendChild(
        svgEl("line", {
          x1: PAD.left,
          x2: W - PAD.right,
          y1: y.toFixed(1),
          y2: y.toFixed(1),
          stroke: "var(--chart-grid)",
          "stroke-width": 1,
        })
      );
      var label = svgEl("text", {
        x: 0,
        y: (y - 4).toFixed(1),
        fill: "var(--chart-axis-text)",
        "font-size": 11,
      });
      label.textContent = window.FructusFormat.koreanUnit(value);
      svg.appendChild(label);
    }
  }

  function xLabels(points, scale, svg) {
    var everyN = points.length > 12 ? Math.ceil(points.length / 8) : 1;
    points.forEach(function (p, i) {
      if (i % everyN !== 0 && i !== points.length - 1) return;
      var label = svgEl("text", {
        x: scale.x(i).toFixed(1),
        y: H - 8,
        fill: "var(--chart-axis-text)",
        "font-size": 11,
        "text-anchor": i === 0 ? "start" : i === points.length - 1 ? "end" : "middle",
      });
      label.textContent = p.label;
      svg.appendChild(label);
    });
  }

  function attachInteraction(svg, points, scale, container) {
    var tooltip = container.querySelector(".chart-tooltip");
    var activeDot = null;

    function showTooltip(i, cx, cy) {
      var p = points[i];
      tooltip.innerHTML =
        "<strong>" +
        p.label +
        "</strong><br>평가금액 " +
        window.FructusFormat.comma(p.total) +
        "원<br>누적원금 " +
        window.FructusFormat.comma(p.principal) +
        "원";
      tooltip.style.left = cx + "px";
      tooltip.style.top = cy + "px";
      tooltip.classList.add("is-visible");
    }

    function hideTooltip() {
      tooltip.classList.remove("is-visible");
    }

    points.forEach(function (p, i) {
      var hit = svgEl("circle", {
        cx: scale.x(i).toFixed(1),
        cy: scale.y(p.total).toFixed(1),
        r: 14,
        fill: "transparent",
        style: "cursor:pointer",
      });
      var dot = svgEl("circle", {
        cx: scale.x(i).toFixed(1),
        cy: scale.y(p.total).toFixed(1),
        r: 3.5,
        fill: "var(--color-accent)",
        opacity: 0,
      });

      function activate() {
        if (activeDot) activeDot.setAttribute("opacity", 0);
        dot.setAttribute("opacity", 1);
        activeDot = dot;
        var pct = points.length > 1 ? i / (points.length - 1) : 0;
        showTooltip(i, pct * 100 + "%", (scale.y(p.total) / H) * 100 + "%");
      }

      hit.addEventListener("pointerenter", activate);
      hit.addEventListener("click", activate);
      hit.addEventListener("pointerleave", function () {
        hideTooltip();
        dot.setAttribute("opacity", 0);
      });

      svg.appendChild(hit);
      svg.appendChild(dot);
    });

    svg.addEventListener("pointerleave", hideTooltip);
  }

  function render(container, points) {
    container.innerHTML = '<div class="chart-tooltip" role="status" aria-live="polite"></div>';
    if (!points || points.length === 0) return;

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, "aria-hidden": "true" });
    var scale = buildScales(points);

    gridLines(scale, svg);

    var totalArea = svgEl("path", {
      d: areaFor(points, scale, "total"),
      fill: "var(--chart-growth-fill)",
      class: "chart-area-draw",
    });
    var principalArea = svgEl("path", {
      d: areaFor(points, scale, "principal"),
      fill: "var(--color-bg)",
      class: "chart-area-draw",
    });
    var principalLine = svgEl("path", {
      d: pathFor(points, scale, "principal"),
      fill: "none",
      stroke: "var(--chart-principal)",
      "stroke-width": 2,
    });
    var totalLine = svgEl("path", {
      d: pathFor(points, scale, "total"),
      fill: "none",
      stroke: "var(--chart-growth)",
      "stroke-width": 2.5,
      class: "chart-draw",
    });

    svg.appendChild(totalArea);
    svg.appendChild(principalArea);
    svg.appendChild(principalLine);
    svg.appendChild(totalLine);
    xLabels(points, scale, svg);

    container.appendChild(svg);
    attachInteraction(svg, points, scale, container);

    // 그래프 드로잉 애니메이션: stroke-dasharray를 실제 길이로 설정한 뒤 0으로 애니메이션
    requestAnimationFrame(function () {
      var length = totalLine.getTotalLength();
      totalLine.style.strokeDasharray = length;
      totalLine.style.strokeDashoffset = length;
      totalArea.style.opacity = 0;
      requestAnimationFrame(function () {
        totalLine.style.strokeDashoffset = 0;
        totalArea.style.opacity = 1;
      });
    });
  }

  return { render: render };
})();
