# SECURITY.md

## 보안 정책

### 지원 버전

| 버전 | 보안 지원 |
| :--- | :--- |
| 최신 릴리즈 | 지원 |
| 이전 버전 | 미지원 |

### 취약점 보고

보안 취약점을 발견하셨다면 GitHub Issues에 공개 보고하지 마시고, 아래 경로로 비공개 보고해 주세요:

- GitHub Security Advisories: [Private vulnerability reporting](https://github.com/your-username/entry-hub/security/advisories/new)

보고 시 다음 내용을 포함해 주세요:
1. 취약점 유형 (XSS, 임의 코드 실행, 정보 유출 등)
2. 재현 방법 (단계별 설명)
3. 영향 범위 (어떤 사용자/데이터에 영향을 미치는지)
4. 가능하면 PoC 코드

### 소스 코드 보안 처리 내역

이 저장소에 공개된 코드에서 아래 항목은 환경변수로 분리되어 있습니다:

| 항목 | 처리 방법 |
| :--- | :--- |
| Supabase URL | `VITE_SUPABASE_URL` 환경변수 |
| Supabase Anon Key | `VITE_SUPABASE_ANON_KEY` 환경변수 |
| 관리자 계정 | `VITE_ADMIN_EMAIL`, `VITE_ADMIN_ENTRY_ID` 환경변수 |

실제 운영 중인 엔드포인트 URL 및 계정 정보는 이 저장소에 포함되지 않습니다.

### 확장프로그램 권한 설명

이 확장프로그램이 요청하는 권한과 그 이유:

| 권한 | 이유 |
| :--- | :--- |
| `host_permissions: https://playentry.org/*` | 엔트리 에디터 페이지에서 사이드패널 UI 삽입 및 `window.Entry` 접근 |
| `host_permissions: https://entry-hub-site.vercel.app/*` | 클라우드 허브 사이트와의 연동 |
| `web_accessible_resources: dist/entry-bridge.js` | MAIN world 스크립트가 엔트리 JS 번들 로드 후 실행되도록 접근 허용 |

이 확장프로그램은:
- 엔트리 계정 비밀번호를 수집하지 않습니다.
- 엔트리 에디터의 작품 데이터를 사용자 동의 없이 외부로 전송하지 않습니다.
- 사용자가 명시적으로 "저장" 버튼을 눌렀을 때만 에셋을 서버에 전송합니다.

