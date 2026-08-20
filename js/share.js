/*
  계산 결과를 브랜드 카드 이미지(PNG)로 렌더링해 저장/공유한다.
  외부 라이브러리(html2canvas 등) 없이 Canvas 2D API로 직접 그린다.
*/
(function () {
  "use strict";

  var btn = document.querySelector("[data-share-image]");
  if (!btn) return;

  var statusEl = document.querySelector("[data-share-status]");
  var Fmt = window.FructusFormat;

  var COLORS = {
    bg: "#ffffff",
    border: "#e8e8e8",
    divider: "#f0f0f0",
    textPrimary: "#111111",
    textMuted: "#888888",
    textSecondary: "#555555",
    accent: "#c45a32",
    principal: "#b9b3ac",
  };

  var UNIT_LABEL = { day: "일", month: "개월", year: "년" };
  var COMPOUND_LABEL = { annual: "연복리", monthly: "월복리", daily: "일복리" };

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message || "";
  }

  function setLoading(isLoading) {
    btn.disabled = isLoading;
    btn.setAttribute("data-loading", String(isLoading));
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCard(input, summary) {
    var W = 960;
    var H = 640;
    var scale = 2;
    var canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    var ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    var padX = 56;

    ctx.fillStyle = COLORS.accent;
    ctx.beginPath();
    ctx.arc(padX + 6, 60, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = "700 24px Hana2, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("Fructus", padX + 22, 61);

    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "500 14px Hana2, sans-serif";
    ctx.fillText("복리 계산 결과", W - padX, 61);
    ctx.textAlign = "left";

    ctx.strokeStyle = COLORS.divider;
    ctx.beginPath();
    ctx.moveTo(padX, 96);
    ctx.lineTo(W - padX, 96);
    ctx.stroke();

    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "500 16px Hana2, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("최종 평가금액", padX, 148);

    ctx.fillStyle = COLORS.accent;
    ctx.font = "800 58px \"Hana2 CM\", Hana2, sans-serif";
    ctx.fillText(Fmt.comma(summary.finalValue) + "원", padX, 210);

    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "400 15px Hana2, sans-serif";
    ctx.fillText(Fmt.koreanUnit(summary.finalValue), padX, 236);

    var metrics = [
      ["총 납입 원금", Fmt.comma(summary.totalPrincipalPaid) + "원", COLORS.textPrimary],
      ["총 수익", Fmt.comma(summary.totalInterest) + "원", COLORS.accent],
      ["총 수익률", summary.returnRatePercent.toFixed(1) + "%", COLORS.textPrimary],
    ];
    var colW = (W - padX * 2) / 3;
    metrics.forEach(function (m, i) {
      var x = padX + colW * i;
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = "500 14px Hana2, sans-serif";
      ctx.fillText(m[0], x, 280);
      ctx.fillStyle = m[2];
      ctx.font = "700 27px \"Hana2 CM\", Hana2, sans-serif";
      ctx.fillText(m[1], x, 312);
    });

    ctx.strokeStyle = COLORS.divider;
    ctx.beginPath();
    ctx.moveTo(padX, 344);
    ctx.lineTo(W - padX, 344);
    ctx.stroke();

    var barY = 372;
    var barH = 14;
    var barX = padX;
    var barW = W - padX * 2;
    var principalPct = summary.finalValue > 0 ? summary.totalPrincipalPaid / summary.finalValue : 1;
    principalPct = Fmt.clamp(principalPct, 0, 1);

    ctx.save();
    roundRectPath(ctx, barX, barY, barW, barH, 7);
    ctx.clip();
    ctx.fillStyle = COLORS.principal;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(barX + barW * principalPct, barY, barW * (1 - principalPct), barH);
    ctx.restore();

    ctx.font = "500 14px Hana2, sans-serif";
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText("원금 " + (principalPct * 100).toFixed(1) + "%", barX, barY + 40);
    ctx.fillStyle = COLORS.accent;
    ctx.fillText("수익 " + ((1 - principalPct) * 100).toFixed(1) + "%", barX + 140, barY + 40);

    ctx.strokeStyle = COLORS.divider;
    ctx.beginPath();
    ctx.moveTo(padX, 448);
    ctx.lineTo(W - padX, 448);
    ctx.stroke();

    var unitLabel = UNIT_LABEL[input.periodUnit] || "";
    var compoundLabel = COMPOUND_LABEL[input.compounding] || "";
    var summaryLine =
      "초기 " + Fmt.comma(input.principal) + "원 · 월 " + Fmt.comma(input.monthlyPayment) + "원 · " +
      input.periodValue + unitLabel + " · 연 " + input.annualRatePercent + "% · " + compoundLabel;

    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = "500 15px Hana2, sans-serif";
    ctx.fillText(summaryLine, padX, 484);

    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "400 12px Hana2, sans-serif";
    wrapText(
      ctx,
      "이 결과는 수학적 시뮬레이션이며 투자 자문이나 수익을 보장하지 않습니다. 세금과 물가 상승은 반영되지 않았습니다.",
      padX,
      512,
      W - padX * 2,
      18
    );

    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.accent;
    ctx.font = "700 14px Hana2, sans-serif";
    ctx.fillText("fructus", W - padX, H - 40);
    ctx.textAlign = "left";

    return canvas;
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    var words = text.split(" ");
    var line = "";
    var lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    lines.forEach(function (l, i) {
      ctx.fillText(l, x, y + i * lineHeight);
    });
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        resolve(blob);
      }, "image/png");
    });
  }

  function saveOrShare(blob) {
    var fileName = "fructus-복리계산결과.png";
    var file;
    try {
      file = new File([blob], fileName, { type: "image/png" });
    } catch (err) {
      file = null;
    }

    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator
        .share({
          files: [file],
          title: "Fructus 복리 계산 결과",
          text: "Fructus로 계산한 복리 결과예요.",
        })
        .then(function () {
          setStatus("공유 화면을 열었어요.");
        })
        .catch(function (err) {
          if (err && err.name === "AbortError") {
            setStatus("");
            return;
          }
          downloadBlob(blob, fileName);
        });
    }

    downloadBlob(blob, fileName);
    return Promise.resolve();
  }

  function downloadBlob(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus("이미지가 저장되었습니다.");
  }

  btn.addEventListener("click", function () {
    var context = window.FructusUI && window.FructusUI.getLastResult ? window.FructusUI.getLastResult() : null;
    if (!context) {
      setStatus("먼저 위에서 복리 계산을 실행해 주세요.");
      return;
    }

    setLoading(true);
    setStatus("이미지를 만들고 있어요…");

    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready
      .then(function () {
        var canvas = drawCard(context, context.summary);
        return canvasToBlob(canvas);
      })
      .then(function (blob) {
        if (!blob) throw new Error("blob-failed");
        return saveOrShare(blob);
      })
      .catch(function () {
        setStatus("이미지를 만들지 못했어요. 다시 시도해 주세요.");
      })
      .finally(function () {
        setLoading(false);
      });
  });
})();
