# 배포 가이드 (Vercel)

## 1. 사전 준비

- GitHub 저장소: `PSHUN03/Codyssey-A1-3` (이미 생성됨)
- Google Gemini API 키: https://aistudio.google.com/apikey 에서 무료 발급
- (선택) Discord 웹훅 URL: 문의 알림을 받을 Discord 채널의 "채널 설정 → 연동 → 웹훅 → 새 웹훅"에서 발급

## 2. GitHub에 코드 푸시

```bash
git remote add origin https://github.com/PSHUN03/Codyssey-A1-3.git
git branch -M main
git push -u origin main
```

## 3. Vercel 프로젝트 생성 및 연동

1. https://vercel.com 에 GitHub 계정으로 로그인한다.
2. "Add New… → Project"에서 `PSHUN03/Codyssey-A1-3` 저장소를 Import 한다.
3. Framework Preset은 "Other"(정적 사이트 + `api/` 폴더 자동 인식)로 둔다. 빌드 명령어는 비워둔다.
4. "Environment Variables" 단계에서 아래 표의 값을 등록한다.
5. "Deploy"를 클릭한다.

## 4. 환경 변수 등록 화면 안내

Vercel 대시보드 → 프로젝트 → **Settings → Environment Variables**에서 아래를 추가한다 (Production/Preview/Development 모두 체크 권장).

| Key | Value | 비고 |
|---|---|---|
| `GEMINI_API_KEY` | 발급받은 Gemini API 키 | 필수. 없으면 AI 코치가 500 오류 반환 |
| `DISCORD_WEBHOOK_URL` | 발급받은 Discord 웹훅 URL | 선택(보너스). 미설정 시 문의는 "접수 성공 + 미전송"으로 폴백 |

값을 저장한 뒤에는 **Deployments 탭에서 최신 배포를 Redeploy**해야 환경 변수가 함수에 반영된다(최초 배포 이후 환경 변수를 추가/변경한 경우 항상 재배포 필요).

## 5. 로컬 환경과 배포 환경의 차이

| 항목 | 로컬(`python -m http.server`) | Vercel 배포 |
|---|---|---|
| 정적 파일 | 그대로 서빙됨 | 동일하게 CDN을 통해 서빙됨 |
| `api/*.py` | 별도 서버 없이는 동작하지 않음(404/501) | Vercel이 각 파일을 독립된 Serverless Function으로 자동 배포, `/api/파일명` 경로로 매핑 |
| 환경 변수 | `.env`를 직접 로드하지 않음 — 로컬 테스트 시 셸에서 `export`/`set`으로 주입 필요 | Vercel 대시보드에 등록한 값이 함수 실행 시 `os.environ`으로 주입됨 |
| Vercel Web Analytics 스크립트 | 404 (정상, 무해함) | 프로젝트에서 Analytics를 활성화하면 정상 동작 |

## 6. 배포 후 오류 수정 → 재배포 흐름

1. 배포된 URL에서 기능을 직접 테스트한다(네비게이션, 반응형, 계산, AI 코치, 문의).
2. 오류가 있으면 Vercel 대시보드 → **Deployments → 해당 배포 → Functions/Logs**에서 서버 로그를 확인한다(단, `api/coach.py`·`api/contact.py`는 `log_message`를 비활성화해 요청 본문은 로그에 남기지 않는다 — 오류 원인은 응답 상태 코드와 예외 타입으로 우선 판단한다).
3. 로컬에서 원인을 재현·수정한다.
4. `git add` → `git commit` → `git push` 하면 Vercel이 자동으로 새 배포를 생성한다(GitHub 연동 시 push마다 자동 배포).
5. 새 배포가 "Ready" 상태가 되면 프로덕션 URL에서 다시 확인한다.

## 7. API 키 유출 시 대응 절차

키가 커밋에 포함되었거나 외부에 노출된 것이 의심되면 아래 순서로 즉시 대응한다.

1. **즉시 폐기**: Google AI Studio(Gemini) 또는 Discord 웹훅 관리 화면에서 해당 키/웹훅을 즉시 삭제(폐기)한다.
2. **재발급**: 새 키/웹훅 URL을 발급받는다.
3. **Vercel 환경 변수 교체**: Settings → Environment Variables에서 값을 새 키로 교체하고 Redeploy한다.
4. **커밋 이력 정리**: 만약 `.env` 등 실제 키 값이 git 커밋에 포함되어 push까지 되었다면,
   - 아직 push 전이라면: `git reset`으로 해당 커밋을 되돌리고 파일을 `.gitignore`에 반영한 뒤 다시 커밋한다.
   - 이미 push되었다면: 키를 1번에서 이미 폐기했으므로 노출된 값 자체는 무효화된 상태다. 이력에서 완전히 제거하려면 `git filter-repo`(권장) 또는 BFG Repo-Cleaner로 해당 파일을 히스토리 전체에서 삭제한 뒤 `git push --force`로 원격을 갱신한다. 이 작업은 다른 협업자에게 영향을 주는 되돌리기 어려운 작업이므로, 팀 저장소라면 반드시 사전 공지 후 진행한다.
5. **재발 방지 확인**: `.env`가 `.gitignore`에 포함되어 있는지, `git status`에 `.env`가 잡히지 않는지 재확인한다.
