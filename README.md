# 크리에이터 대시보드

유튜브·인스타그램 크리에이터를 위한 올인원 대시보드 (기능 뼈대 단계).

- 설계: `docs/superpowers/specs/2026-09-28-creator-dashboard-foundation-design.md`
- 구현 계획: `docs/superpowers/plans/2026-09-28-creator-dashboard-foundation.md`

## 준비물 (모두 무료)

| 항목 | 용도 |
|---|---|
| Node.js 22.12 이상 (권장 24) | 개발 서버 |
| Supabase 프로젝트 (무료 플랜) | DB, 로그인, 실시간 동기화 |
| Google Cloud 프로젝트 | YouTube Data API 키, 구글 로그인 |

## 1. Supabase 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만든다.
2. **SQL Editor**에서 `supabase/migrations/0001_init.sql` 전체를 붙여넣고 실행한다.
   이어서 `supabase/migrations/0002_trend_sources.sql`도 실행한다.
   이미 운영 중인 프로젝트를 업데이트할 때는 새 코드를 배포하기 **전에** 0002를 먼저 실행한다. 순서가 바뀌면 실시간 동기화와 트렌드 조회가 실패한다.
3. 이어서 `supabase/tests/rls_check.sql`을 실행해 결과가 `RLS OK`인지 확인한다.
4. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000`
   - Redirect URLs에 `http://localhost:3000/auth/callback` 추가
5. **Project Settings → API**에서 Project URL과 anon(public) key를 복사해 둔다.

## 2. YouTube Data API 키

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 만든다.
2. **APIs & Services → Library**에서 "YouTube Data API v3"를 사용 설정한다.
3. **APIs & Services → Credentials → Create credentials → API key**로 키를 만든다.
4. 키 제한(API restrictions)을 "YouTube Data API v3"로 걸어 둔다.

하루 무료 할당량은 10,000 units. 이 앱은 트렌드를 한 번 가져올 때 약 430 units를 쓴다 (가장 오래 쓰지 않은 키워드 그룹 4개 × 검색 1회 100 units + 벤치마킹 채널 최대 10개 + 영상 상세 조회). "오늘 트렌드 다시 가져오기"도 한 번에 같은 양을 쓴다. 키워드는 최대 100개, 채널은 최대 10개까지 등록할 수 있다. 결제 정보는 필요 없다.

## 3. 구글 로그인 (선택)

1. Google Cloud Console → **APIs & Services → OAuth consent screen**을 설정한다 (External, 테스트 사용자에 본인 이메일 추가).
2. **Credentials → Create credentials → OAuth client ID** → Web application
   - Authorized redirect URIs: `https://<프로젝트-ref>.supabase.co/auth/v1/callback`
     (Supabase의 Authentication → Sign In / Providers → Google 화면에 정확한 주소가 표시된다)
3. 발급된 Client ID와 Client Secret을 Supabase의 Google provider에 입력하고 활성화한다.

## 4. 실행

```bash
cp .env.example .env.local   # 값 세 개를 채운다
npm install
npm run dev
```

http://localhost:3000 → 회원가입 → YouTube 대시보드.

## 폰에서 테스트하기

1. PC와 폰을 같은 Wi-Fi에 연결한다.
2. PC에서 개발 서버를 모든 네트워크 인터페이스에 열어 실행한다.
   ```bash
   npm run dev -- -H 0.0.0.0
   ```
3. PC의 내부 IP를 확인한다 (Windows: `ipconfig`, macOS/Linux: `ifconfig`).
4. 폰 브라우저에서 `http://<PC의 내부 IP>:3000` 으로 접속한다.
5. Supabase **Authentication → URL Configuration → Redirect URLs**에 `http://<PC의 내부 IP>:3000/auth/callback` 을 추가한다.
6. `next.config.ts`의 `allowedDevOrigins` 주석을 풀고 **PC의 내부 IP**를 넣는다. Next.js 16 개발 서버는 localhost가 아닌 주소의 개발용 요청(HMR 등)을 막기 때문이다. 이 변경은 커밋하지 않아도 된다.
7. 이메일 확인 링크는 Site URL(즉 `http://localhost:3000`)을 가리킨다. 그래서 **회원가입과 이메일 확인은 PC에서** 먼저 하고, 폰에서는 이미 만들어진 계정으로 **로그인만** 한다.

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run typecheck` | 타입 체크 |
| `npm run lint` | ESLint |
