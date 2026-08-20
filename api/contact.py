"""
문의하기 접수 엔드포인트 (보너스: 운영 자동화).
Discord 웹훅 URL이 환경 변수에 설정되어 있으면 문의 내용을 전달하고,
설정되어 있지 않아도 서비스가 죽지 않도록 접수 자체는 항상 성공 처리한다
(전송 여부만 내부적으로 "delivered" 값으로 구분).
"""

import json
import os
import re
from http.server import BaseHTTPRequestHandler

import requests

MAX_BODY_BYTES = 6000
MAX_MESSAGE_LENGTH = 1000
REQUEST_TIMEOUT_SECONDS = 10
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

TYPE_LABELS = {
    "general": "일반 문의",
    "bug": "오류 신고",
    "feature": "기능 제안",
    "etc": "기타",
}


def _json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _validate(data):
    if not isinstance(data, dict):
        return "요청 본문이 올바르지 않습니다."

    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        return "이름을 입력해 주세요."

    email = data.get("email")
    if not isinstance(email, str) or not EMAIL_RE.match(email.strip()):
        return "올바른 이메일 형식을 입력해 주세요."

    message = data.get("message")
    if not isinstance(message, str) or not message.strip():
        return "문의 내용을 입력해 주세요."
    if len(message) > MAX_MESSAGE_LENGTH:
        return "문의 내용은 {}자 이내로 입력해 주세요.".format(MAX_MESSAGE_LENGTH)

    return None


def _send_to_discord(webhook_url, data):
    type_label = TYPE_LABELS.get(data.get("type"), "기타")
    content = (
        "**Fructus 새 문의**\n"
        "- 이름: {name}\n"
        "- 이메일: {email}\n"
        "- 유형: {type_label}\n"
        "- 내용: {message}"
    ).format(
        name=data["name"].strip()[:100],
        email=data["email"].strip()[:200],
        type_label=type_label,
        message=data["message"].strip()[:MAX_MESSAGE_LENGTH],
    )
    response = requests.post(
        webhook_url,
        json={"content": content[:1900]},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
        except (TypeError, ValueError):
            content_length = 0

        if content_length <= 0 or content_length > MAX_BODY_BYTES:
            _json_response(self, 400, {"error": "요청 본문 크기가 올바르지 않습니다."})
            return

        raw_body = self.rfile.read(content_length)

        try:
            data = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            _json_response(self, 400, {"error": "요청 본문을 해석할 수 없습니다."})
            return

        validation_error = _validate(data)
        if validation_error:
            _json_response(self, 400, {"error": validation_error})
            return

        webhook_url = os.environ.get("DISCORD_WEBHOOK_URL")
        delivered = False

        if webhook_url:
            try:
                _send_to_discord(webhook_url, data)
                delivered = True
            except requests.exceptions.RequestException:
                # 웹훅 전송 실패는 사용자 경험을 막지 않는다. 접수 자체는 성공으로 처리한다.
                delivered = False
        else:
            # 웹훅 미설정 환경: 서비스가 죽지 않도록 접수는 성공 처리하고 미전송 상태만 기록한다.
            delivered = False

        _json_response(self, 200, {"ok": True, "delivered": delivered})

    def do_GET(self):
        _json_response(self, 405, {"error": "POST 요청만 허용됩니다."})

    def log_message(self, format, *args):
        pass
