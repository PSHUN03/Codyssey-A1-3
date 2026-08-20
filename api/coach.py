"""
AI 투자 코치 엔드포인트 (Vercel Python Serverless Function).
프론트(js/ai.js)가 계산 결과 + 사용자 목표 문장을 POST로 보내면,
Google Gemini API를 호출해 목표 달성 진단/부족분 해석/실행 조언 3가지/주의사항을
구조화된 JSON으로 반환한다.
"""

import json
import os
import re
from http.server import BaseHTTPRequestHandler

import requests

MAX_GOAL_LENGTH = 300
MAX_BODY_BYTES = 8000
REQUEST_TIMEOUT_SECONDS = 20
# Gemini 3 계열은 답변 전에 내부 '생각(thinking)' 토큰을 소비하며, 그 양도
# maxOutputTokens 예산에서 함께 차감된다. 예산이 빠듯하면 생각하다가 본문이
# 중간에 잘려(JSON이 닫히지 않은 채) 돌아오므로, 실제 답변이 온전히 담길
# 여유까지 포함해 상한을 잡는다(과금 방어용 상한 자체는 그대로 유지).
MAX_OUTPUT_TOKENS = 4096

# 응답을 반드시 이 구조의 JSON으로만 뱉도록 Gemini에 강제한다. 모델이
# 마크다운 코드펜스나 설명 문장을 섞어 보내 파싱이 깨지는 문제를
# 프롬프트 지시가 아니라 API 차원에서 원천 차단하기 위함이다.
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "diagnosis": {"type": "string"},
        "gap": {"type": "string"},
        "actions": {"type": "array", "items": {"type": "string"}},
        "caution": {"type": "string"},
    },
    "required": ["diagnosis", "gap", "actions", "caution"],
}
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_MODEL = "gemini-3.6-flash"

REQUIRED_NUMERIC_FIELDS = [
    "principal",
    "monthlyPayment",
    "periodValue",
    "annualRatePercent",
    "finalValue",
    "totalPrincipalPaid",
    "totalInterest",
    "returnRatePercent",
]


def _json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _won(value):
    try:
        return "{:,.0f}원".format(round(float(value)))
    except (TypeError, ValueError):
        return "0원"


def _validate_payload(data):
    if not isinstance(data, dict):
        return "요청 본문이 올바르지 않습니다."

    goal = data.get("goalText")
    if not isinstance(goal, str) or not goal.strip():
        return "목표를 한 줄이라도 입력해 주세요."
    if len(goal) > MAX_GOAL_LENGTH:
        return "목표 설명은 {}자 이내로 입력해 주세요.".format(MAX_GOAL_LENGTH)

    for field in REQUIRED_NUMERIC_FIELDS:
        value = data.get(field)
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            return "계산 결과가 없습니다. 먼저 복리 계산을 실행해 주세요."

    period_unit = data.get("periodUnit")
    if period_unit not in ("day", "month", "year"):
        return "기간 단위가 올바르지 않습니다."

    compounding = data.get("compounding")
    if compounding not in ("annual", "monthly", "daily"):
        return "복리 주기가 올바르지 않습니다."

    return None


def _build_prompt(data):
    unit_label = {"day": "일", "month": "개월", "year": "년"}[data["periodUnit"]]
    compounding_label = {"annual": "연복리", "monthly": "월복리", "daily": "일복리"}[data["compounding"]]

    return (
        "당신은 신중하고 현실적인 개인 재무 코치입니다. 아래 복리 계산 결과와 "
        "사용자의 목표를 보고, 반드시 아래 JSON 스키마만 출력하세요. "
        "마크다운이나 설명 문장 없이 JSON 객체 하나만 출력해야 합니다.\n\n"
        "스키마:\n"
        "{{\n"
        '  "diagnosis": "목표 달성 가능성에 대한 2~3문장 진단",\n'
        '  "gap": "부족분 또는 여유분에 대한 해석 2~3문장",\n'
        '  "actions": ["실행 가능한 조언 1", "실행 가능한 조언 2", "실행 가능한 조언 3"],\n'
        '  "caution": "투자 자문이 아니라는 점을 포함한 주의사항 한 문장"\n'
        "}}\n\n"
        "계산 조건:\n"
        "- 초기 금액: {principal}\n"
        "- 월 적립액: {monthly}\n"
        "- 투자 기간: {period}{unit}\n"
        "- 목표 수익률(연): {rate}%\n"
        "- 복리 주기: {compounding}\n"
        "- 최종 평가금액: {final}\n"
        "- 총 납입 원금: {paid}\n"
        "- 총 이자 수익: {interest}\n"
        "- 총 수익률: {return_rate}%\n\n"
        "사용자가 적은 목표/상황: \"{goal}\"\n\n"
        "조언은 한국어로, 구체적이고 실행 가능하게 작성하세요. 특정 종목이나 "
        "금융상품을 추천하지 마세요."
    ).format(
        principal=_won(data["principal"]),
        monthly=_won(data["monthlyPayment"]),
        period=data["periodValue"],
        unit=unit_label,
        rate=data["annualRatePercent"],
        compounding=compounding_label,
        final=_won(data["finalValue"]),
        paid=_won(data["totalPrincipalPaid"]),
        interest=_won(data["totalInterest"]),
        return_rate=round(float(data["returnRatePercent"]), 1),
        goal=data["goalText"].strip()[:MAX_GOAL_LENGTH],
    )


def _extract_json(text):
    cleaned = text.strip()
    # responseSchema를 쓰면 순수 JSON이 오지만, 혹시 코드펜스가 섞여 와도
    # 깨지지 않도록 방어적으로 벗겨낸다.
    cleaned = re.sub(r"^```(?:json)?", "", cleaned.strip())
    cleaned = re.sub(r"```$", "", cleaned.strip())

    try:
        parsed = json.loads(cleaned)
    except (ValueError, TypeError):
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            # 응답이 잘렸는지 등을 바로 알 수 있도록 앞부분을 함께 남긴다.
            raise ValueError("no-json-found text={!r}".format(cleaned[:120]))
        parsed = json.loads(match.group(0))

    if not isinstance(parsed, dict):
        raise ValueError("not-an-object")

    actions = parsed.get("actions")
    if not isinstance(actions, list) or len(actions) < 1:
        raise ValueError("invalid-actions")

    return {
        "diagnosis": str(parsed.get("diagnosis", "")).strip() or "진단 결과를 생성하지 못했습니다.",
        "gap": str(parsed.get("gap", "")).strip() or "부족분 정보를 생성하지 못했습니다.",
        "actions": [str(a).strip() for a in actions[:3]],
        "caution": str(parsed.get("caution", "")).strip()
        or "이 답변은 투자 자문이 아니며 수익을 보장하지 않습니다.",
    }


def _upstream_reason(response):
    """Gemini가 돌려준 에러에서 원인만 뽑아낸다.

    Google의 에러 본문에는 API 키가 포함되지 않으므로 status/message만
    추려서 노출해도 안전하다. 원인 파악이 불가능한 '일시적인 오류'
    메시지만 반복되는 상황을 막기 위한 진단용.
    """
    if response is None:
        return "unknown"
    try:
        detail = (response.json() or {}).get("error", {})
        reason = detail.get("status") or ""
        message = detail.get("message") or ""
        combined = " ".join(part for part in (reason, message) if part).strip()
    except Exception:
        combined = ""
    return "{} {}".format(response.status_code, combined[:200]).strip()


def _generation_config(with_thinking_level):
    """generationConfig를 만든다.

    thinkingLevel은 Gemini 3 계열 전용 옵션이라, 모델/API 버전에 따라
    알 수 없는 필드로 거부될 수 있다. 그래서 이 값을 뺀 설정도 만들 수
    있게 해두고, 거부당하면 호출부에서 한 번 더 시도한다.
    """
    config = {
        "maxOutputTokens": MAX_OUTPUT_TOKENS,
        "temperature": 0.6,
        # 응답을 스키마에 맞는 순수 JSON으로만 받도록 강제한다.
        "responseMimeType": "application/json",
        "responseSchema": RESPONSE_SCHEMA,
    }
    if with_thinking_level:
        # 내부 추론을 최소화해 토큰 예산을 실제 답변에 쓰게 한다.
        config["thinkingLevel"] = "minimal"
    return config


def _post_gemini(url, api_key, prompt, with_thinking_level):
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": _generation_config(with_thinking_level),
    }
    # 키는 URL 쿼리스트링 대신 헤더로 보낸다. URL에 담으면 프록시/로그에
    # 키가 그대로 남을 수 있기 때문이다.
    headers = {"x-goog-api-key": api_key}
    return requests.post(
        url, json=body, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS
    )


def _call_gemini(prompt, api_key, model):
    url = "{}/{}:generateContent".format(GEMINI_API_BASE, model)

    response = _post_gemini(url, api_key, prompt, with_thinking_level=True)
    # thinkingLevel을 모르는 모델이면 400이 오므로, 그 옵션만 빼고 재시도한다.
    if response.status_code == 400 and "thinking" in response.text.lower():
        response = _post_gemini(url, api_key, prompt, with_thinking_level=False)

    response.raise_for_status()
    payload = response.json()

    candidates = payload.get("candidates") or []
    if not candidates:
        # 안전 필터 등으로 후보가 아예 없는 경우 그 사유를 그대로 노출한다.
        feedback = payload.get("promptFeedback") or {}
        raise ValueError("empty-candidates {}".format(feedback.get("blockReason") or ""))

    candidate = candidates[0]
    parts = (candidate.get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts)

    if not text:
        # 토큰 예산이 생각에 모두 소진되면 본문 없이 MAX_TOKENS로 끝난다.
        raise ValueError("empty-text finishReason={}".format(candidate.get("finishReason")))

    return text


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # 예상하지 못한 예외로 커넥션이 응답 없이 끊기는 것을 막기 위한
        # 최상위 안전망. 이 아래 로직에서 무엇이 터지든 항상 유효한
        # JSON 응답을 클라이언트에 돌려준다.
        try:
            self._handle_post()
        except Exception:
            try:
                _json_response(self, 500, {"error": "일시적인 오류가 발생했습니다."})
            except Exception:
                pass

    def _handle_post(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
        except (TypeError, ValueError):
            content_length = 0

        if content_length <= 0 or content_length > MAX_BODY_BYTES:
            _json_response(self, 400, {"error": "요청 본문 크기가 올바르지 않습니다."})
            return

        try:
            raw_body = self.rfile.read(content_length)
        except Exception:
            _json_response(self, 400, {"error": "요청 본문을 읽지 못했습니다."})
            return

        try:
            data = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            _json_response(self, 400, {"error": "요청 본문을 해석할 수 없습니다."})
            return

        validation_error = _validate_payload(data)
        if validation_error:
            _json_response(self, 400, {"error": validation_error})
            return

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            # 키 값은 절대 로그/응답에 노출하지 않는다.
            _json_response(self, 500, {"error": "AI 코치를 사용할 수 없습니다. 서버 설정을 확인해 주세요."})
            return

        prompt = _build_prompt(data)

        try:
            raw_text = _call_gemini(prompt, api_key, GEMINI_MODEL)
            result = _extract_json(raw_text)
        except requests.exceptions.Timeout:
            _json_response(self, 504, {"error": "AI 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."})
            return
        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else 502
            if status == 429:
                _json_response(self, 429, {"error": "요청이 많습니다. 잠시 후 다시 시도해 주세요."})
            else:
                # 상태 코드와 Google이 준 사유를 함께 노출한다(키는 포함되지 않는다).
                # 원인 불명의 "일시적인 오류"만 반복되면 디버깅이 불가능하기 때문.
                _json_response(
                    self,
                    502,
                    {
                        "error": "AI 서비스 호출 중 오류가 발생했습니다.",
                        "detail": _upstream_reason(exc.response),
                    },
                )
            return
        except (requests.exceptions.RequestException, ValueError, json.JSONDecodeError, KeyError) as exc:
            _json_response(
                self,
                502,
                {
                    "error": "AI 응답을 처리하지 못했습니다. 다시 시도해 주세요.",
                    "detail": "{}: {}".format(type(exc).__name__, str(exc)[:200]),
                },
            )
            return
        except Exception:
            _json_response(self, 500, {"error": "일시적인 오류가 발생했습니다."})
            return

        _json_response(self, 200, result)

    def do_GET(self):
        _json_response(self, 405, {"error": "POST 요청만 허용됩니다."})

    def log_message(self, format, *args):
        # 요청 본문(목표 문장, API 키 등)이 서버 로그에 남지 않도록 기본 접근 로그를 끈다.
        pass
