<p align="center">
  <img src="docs/assets/icon128.png" alt="Entry-Hub Logo" width="100" />
</p>

<h1 align="center">Entry-Hub (엔트리 허브)</h1>

<p align="center">
  <b>엔트리(Entry) 창작자를 위한 오픈소스 에셋 공유 & 실시간 주입 플랫폼</b><br />
  코드 블록, 커스텀 오브젝트, 장면, 함수를 단 한 번의 클릭으로 추출하고 에디터에 주입하세요.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
</p>

---

## 소개

Entry-Hub는 엔트리(playentry.org) 에디터에 직접 삽입되는 Chrome 확장프로그램입니다.

- 현재 편집 중인 코드 블록 / 오브젝트 / 장면을 클릭 한 번으로 추출하여 로컬 허브 또는 클라우드에 저장합니다.
- 저장된 에셋을 다른 엔트리 작품에 클릭 한 번으로 불러와 에디터에 그대로 주입합니다.
- 커뮤니티 에셋 허브를 통해 세계 엔트리 창작자들과 에셋을 공유합니다.

---

## 주요 기능

| 기능 | 설명 |
| :--- | :--- |
| **코드 블록 추출/주입** | 현재 선택된 스레드(블록 묶음)를 JSON으로 추출, 변수/리스트/함수 의존성 포함 |
| **오브젝트 추출/주입** | 오브젝트 전체(모양, 소리, 스크립트)를 추출, ID 불일치 없이 완벽 주입 |
| **장면 추출/주입** | 장면 전체 오브젝트 묶음 추출/주입, 새 장면으로 생성 |
| **로컬 허브** | 폴더 구조로 에셋을 로컬에 보관 |
| **블록 미리보기** | 저장된 블록 코드를 엔트리 블록 디자인으로 시각화 |
| **모양/소리 갤러리** | 오브젝트의 모양 이미지와 소리 목록 미리보기 |

---

## 아키텍처 개요

```
Chrome Extension (Manifest V3)
├── entry-bridge.js  (MAIN world)   ← window.Entry 직접 접근, 에셋 추출/주입 엔진
└── content.js       (Content Script) ← React 사이드패널 UI, Supabase API 통신

두 스크립트는 window.postMessage 브릿지로 통신
```

자세한 아키텍처 및 구현 가이드는 [extension.md](../extension.md)를 참고하세요.

---

## 시작하기

### 필요 조건

- Node.js 18 이상
- npm 또는 pnpm
- Chrome 브라우저

### 설치 및 빌드

```bash
# 1. 저장소 클론
git clone https://github.com/your-username/entry-hub.git
cd entry-hub

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일을 열어 Supabase URL과 ANON KEY를 입력하세요

# 3. 의존성 설치
npm install

# 4. 확장프로그램 빌드
npm run build:ext
# 빌드 결과: apps/extension/dist/
```

### Chrome에 설치

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. `apps/extension/` 폴더 선택

### 환경 변수

| 변수명 | 설명 | 필수 |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL | 클라우드 기능 사용 시 |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | 클라우드 기능 사용 시 |

> Supabase 없이도 로컬 허브 기능은 완전히 작동합니다.

---

## 프로젝트 구조

```
entry-hub/
├── apps/
│   └── extension/           # Chrome 확장프로그램
│       ├── src/
│       │   ├── content/
│       │   │   ├── entry-bridge.ts    # 엔트리 엔진 조작 핵심 (MAIN world)
│       │   │   └── index.tsx          # 사이드패널 React 앱
│       │   ├── adapters/              # postMessage 브릿지 어댑터
│       │   ├── infrastructure/        # Supabase 클라이언트, 로컬 스토리지
│       │   └── ui/                    # React 컴포넌트 & 탭
│       └── manifest.json
├── packages/
│   ├── core/                # 공유 타입 정의
│   └── shared/              # 공유 유틸리티 (blockModel, 에셋 포매터 등)
├── supabase/
│   └── schema.sql           # DB 스키마
├── extension.md             # 확장프로그램 개발 상세 가이드
├── error.md                 # 버그 분석 및 해결 기록
└── .env.example             # 환경 변수 예시
```

---

## 핵심 기술 노트

엔트리 블록 에셋을 올바르게 주입하기 위해 반드시 알아야 할 사항입니다.

### toJSON(false) 를 사용해야 한다

`Entry.EntryObject.prototype.toJSON(isClone)` 에서:
- `isClone=true`: picture/sound ID가 모두 `Entry.generateHash()`로 새로 생성됨 → script 내 ID와 불일치 → 모양/소리 블록이 대상없음으로 표시
- `isClone=false`: ID가 그대로 보존됨 → 정상 작동

```ts
// 올바른 방법
const projectData = Entry.exportProject();  // 내부적으로 toJSON(false) 사용
const obj = projectData.objects.find(o => o.id === targetId);
```

더 자세한 내용은 [error.md](../error.md)를 참고하세요.

---

## 기여하기

1. 이 저장소를 Fork합니다.
2. 새 브랜치를 만듭니다: `git checkout -b feature/my-feature`
3. 변경 사항을 커밋합니다: `git commit -m 'feat: add my feature'`
4. 브랜치에 Push합니다: `git push origin feature/my-feature`
5. Pull Request를 열어 주세요.

버그 리포트나 기능 제안은 GitHub Issues를 이용해 주세요.

---

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. [LICENSE](LICENSE) 파일을 참고하세요.

> 이 확장프로그램은 엔트리(playentry.org)의 비공식 서드파티 도구입니다.
> 엔트리 측과 공식 제휴 관계가 아니며, 엔트리 서비스의 이용약관을 준수하여 사용하세요.

---

## 보안

보안 취약점을 발견하셨다면 GitHub Issues에 공개 보고하지 마시고, 직접 연락해 주세요.

이 확장프로그램의 소스 코드 공개 범위:
- 엔트리 에디터 조작 로직 (`entry-bridge.ts`): 공개
- UI 컴포넌트: 공개
- Supabase 연동 코드: 공개 (실제 URL/KEY는 환경변수로 분리, 하드코딩 없음)
- 관리자 계정 정보: 미포함

