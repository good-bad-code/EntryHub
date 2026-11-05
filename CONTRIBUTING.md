# Contributing to Entry-Hub

먼저 기여에 관심을 가져주셔서 감사합니다!

## 개발 환경 세팅

```bash
git clone https://github.com/your-username/entry-hub.git
cd entry-hub
cp .env.example .env
# .env에 Supabase 정보 입력 (선택사항, 로컬 허브 기능만 쓰면 불필요)
npm install
npm run build:ext
```

## 브랜치 전략

| 브랜치 | 용도 |
| :--- | :--- |
| `main` | 안정화 릴리즈 |
| `dev` | 개발 통합 브랜치 |
| `feature/*` | 새 기능 개발 |
| `fix/*` | 버그 수정 |

## 커밋 메시지 규칙

```
feat: 새 기능 추가
fix: 버그 수정
docs: 문서 수정
refactor: 코드 리팩토링
chore: 빌드/설정 변경
```

## 보안 주의사항

- `.env` 파일은 절대 커밋하지 마세요.
- 실제 Supabase URL/KEY, 이메일 주소 등을 소스 코드에 하드코딩하지 마세요.
- 모든 민감 정보는 `import.meta.env.VITE_*` 환경변수를 통해 주입하세요.

## Pull Request 전 체크리스트

- [ ] `npm run build:ext` 가 오류 없이 성공하는지 확인
- [ ] 하드코딩된 이메일/API 키/비밀번호가 없는지 확인
- [ ] 한국어 주석은 그대로 유지 (엔트리는 한국 서비스)

## 버그 리포트

GitHub Issues에 다음 정보를 포함해 주세요:
1. Chrome 버전
2. 엔트리 에디터 URL (`/ws/...`)
3. 오류 발생 시 Console 오류 메시지 (F12 → Console)
4. 재현 방법

## 아키텍처 이해

[extension.md](extension.md)를 먼저 읽어 주세요. 엔트리 에디터 조작 방식, MAIN world vs Content Script 차이, postMessage 브릿지 패턴 등이 상세히 설명되어 있습니다.

