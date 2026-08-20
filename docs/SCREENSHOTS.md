# 스크린샷 증빙 가이드

배포된 실제 URL(`<<DEPLOY_URL>>`)에서 촬영해야 진짜 증빙이 된다. 로컬 미리보기가
아니라 **Vercel 배포 URL**에서, 실제 Gemini 키가 연결된 상태로 AI 코치 성공 화면까지
포함해서 찍는 것이 핵심이다.

## 파일명 규칙

`docs/screenshots/` 폴더에 아래 형식으로 저장한다.

```
{번호}_{디바이스}_{페이지또는기능}.png
예: 01_desktop_home.png, 02_mobile_home.png, 05_desktop_ai_coach_success.png
```

## 체크리스트 (최소 촬영 목록)

| # | 파일명(예) | 디바이스/뷰포트 | 내용 |
|---|---|---|---|
| 1 | `01_desktop_home.png` | 데스크톱(1280px+) | 홈/계산기 페이지 Hero + 입력 폼 전체 |
| 2 | `02_desktop_result.png` | 데스크톱 | 계산 실행 후 결과 요약 리스트(최종 평가금액 강조) + 그래프가 보이는 화면 |
| 3 | `03_desktop_table.png` | 데스크톱 | 연도별 상세 표 |
| 4 | `04_desktop_ai_coach_success.png` | 데스크톱 | AI 투자 코치에 목표를 입력하고 **정상 응답을 받은 화면**(카드 UI로 렌더된 진단/조언) |
| 5 | `05_desktop_ai_coach_error.png` | 데스크톱 | 빈 입력 또는 오류 상황에서 실패 처리 메시지가 보이는 화면 |
| 6 | `06_mobile_home.png` | 모바일(360~390px) | 홈 페이지, 햄버거 메뉴가 보이는 상태 |
| 7 | `07_mobile_menu_open.png` | 모바일 | 햄버거 메뉴를 펼친 상태(전체 내비게이션 노출) |
| 8 | `08_mobile_result.png` | 모바일 | 계산 결과 카드 + 그래프(모바일 레이아웃) |
| 9 | `09_mobile_ai_coach.png` | 모바일 | AI 코치 사용 화면(모바일) |
| 10 | `10_desktop_learn.png` | 데스크톱 | 복리 알아보기 페이지 |
| 11 | `11_desktop_faq.png` | 데스크톱 | FAQ 페이지, 아코디언 1개 이상 펼친 상태 |
| 12 | `12_desktop_contact.png` | 데스크톱 | 문의하기 페이지 + 제출 성공 메시지 |
| 13 | `13_dark_mode.png` | 데스크톱 또는 모바일 | 다크 모드 적용 화면 |

## 촬영 방법 (택 1)

1. **브라우저 자체 스크린샷**: 배포 URL 접속 → 개발자도구(F12) → 기기 툴바(Ctrl+Shift+M)로
   모바일 뷰(예: 390×844) 전환 → 전체 페이지 캡처(우클릭 "Capture full size screenshot"
   또는 스크린샷 확장 프로그램 사용).
2. **OS 스크린샷 도구**: Windows는 `Win + Shift + S`로 원하는 영역만 캡처.

## 저장 위치

모든 이미지를 `docs/screenshots/` 폴더에 저장한 뒤, 아래처럼 이 문서 하단에 인라인으로
삽입하고 git에 커밋한다.

```markdown
### 홈 화면 (데스크톱)
![홈 데스크톱](screenshots/01_desktop_home.png)
```

## AI 코딩 도구 사용 증빙

과제 제출용 "AI 코딩 도구 사용 과정" 증빙은 `docs/AI_USAGE_LOG.md`(단계별 프롬프트 요약 +
실제 오류 3건의 발견/수정 과정)로 대체한다. 추가로 원본 대화 로그 전체를 남기고 싶다면
Claude Code 세션 내보내기 기능(있는 경우) 또는 대화 화면을 캡처해 `docs/screenshots/`에
`14_ai_tool_conversation.png` 형식으로 추가한다.

---

## 삽입된 스크린샷

> 아래에 실제 촬영한 이미지를 추가하세요. 위 체크리스트 순서를 그대로 따르는 것을 권장합니다.

<!-- 예시:
### 홈 화면 (데스크톱)
![홈 데스크톱](screenshots/01_desktop_home.png)

### 홈 화면 (모바일)
![홈 모바일](screenshots/06_mobile_home.png)
-->
