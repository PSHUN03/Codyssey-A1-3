# 학습 목표 정리

과제가 요구하는 6개 학습 목표를 이 프로젝트의 실제 코드를 근거로 설명한다.

## 1. HTML / CSS / JavaScript의 역할

HTML(`index.html` 등)은 화면의 뼈대(입력 폼, 결과 카드, 표 등 구조)를 담당한다.
CSS(`css/variables.css`~`pages.css`)는 그 구조에 색·간격·타이포그래피 등 "보이는 방식"을
입힌다. JavaScript(`js/calculator.js`, `js/ui.js` 등)는 "동작"을 담당한다 — 사용자가
값을 입력했을 때 계산을 수행하고, 결과를 다시 HTML에 써 넣는 것은 모두 JS의 역할이다.
셋은 각각 구조·표현·동작으로 완전히 분리되어 있다.

## 2. 입력 → fetch → 화면 반영 흐름

AI 투자 코치가 대표 사례다. `js/ai.js`에서 textarea 값과 계산 결과를 모아 객체로 만든 뒤,
`fetch('/api/coach', { method: 'POST', body: JSON.stringify(payload) })`로 서버에 보낸다.
서버(`api/coach.py`)가 JSON을 반환하면 `.then(res => res.json())`으로 파싱하고,
`renderResult()` 함수가 그 데이터를 카드 HTML로 바꿔 `resultBox.innerHTML`에 넣는다.
즉 "입력 → 객체화 → fetch 전송 → JSON 응답 → DOM 갱신"의 흐름이다.

## 3. Vercel Serverless Functions와 프론트-백엔드 호출 구조

`api/` 폴더 아래의 `coach.py`, `contact.py`처럼 `BaseHTTPRequestHandler`를 상속한
`handler` 클래스를 각 파일에 하나씩 두면, Vercel이 이를 개별 서버리스 함수로 배포하고
`/api/coach`, `/api/contact` 경로에 자동으로 연결해 준다. 상시 실행되는 서버가 아니라
요청이 올 때만 실행되고 끝나는 구조라 별도 서버 관리가 필요 없다. 프론트는 이 경로를
그냥 같은 도메인의 API처럼 `fetch`로 호출하면 된다.

## 4. 환경 변수로 API 키를 관리해야 하는 이유

`GEMINI_API_KEY`를 코드에 직접 적으면 GitHub에 그대로 노출되어 누구나 그 키로 과금을
발생시킬 수 있다. `api/coach.py`는 `os.environ.get("GEMINI_API_KEY")`로 키를 런타임에만
읽고, 실제 값은 Vercel 대시보드(서버 쪽)에만 저장한다. `.env`는 `.gitignore`에 포함되어
커밋되지 않고, `.env.example`에는 키 이름만 남겨 "무엇을 설정해야 하는지"만 공유한다.

## 5. 로컬 환경과 배포 환경의 차이, 재배포 흐름

로컬에서는 `python -m http.server`로 정적 파일만 확인할 수 있고 `api/*.py`는 동작하지
않는다(별도 서버가 없기 때문). 배포 환경(Vercel)에서는 같은 코드가 서버리스 함수로
실행되고, 환경 변수도 대시보드 값이 주입된다. 그래서 로컬에서는 계산기 UI와 검증
로직 위주로 확인하고, AI 코치의 실제 응답은 배포 후 확인해야 한다. 코드를 고치면
`git push` → Vercel이 자동으로 새 배포를 만들고 → 새 URL에서 재확인하는 순서를 따른다.

## 6. AI가 만든 코드의 오류 원인 파악 및 수정 방향

실제로 겪은 사례(`docs/AI_USAGE_LOG.md` 참고): AI 코치의 "다시 시도" 버튼이 `hidden`
속성에도 화면에 계속 보이는 문제가 있었다. 스크린샷으로 증상을 먼저 확인한 뒤,
"버튼에 적용된 `.btn` 클래스가 `display: inline-flex`를 지정하고 있어 브라우저 기본
`[hidden] { display: none }` 규칙과 우선순위가 같은 상태에서, CSS 명시도(specificity)는
같지만 나중에 로드된 저자 스타일시트가 이긴다"는 원인을 특정했다. 수정은 `[hidden]`에
`!important`를 주는 한 줄로 끝났지만, 핵심은 "AI가 짠 코드가 왜 이렇게 동작하는지"를
CSS 캐스케이드 규칙으로 설명할 수 있어야 올바른 수정 지점을 고를 수 있었다는 점이다.
