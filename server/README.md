# 클라우드플레어 멀티플레이 서버

운영 주소: `wss://capitalist-chess.gwonoheon1.workers.dev`

Workers가 HTTP 요청을 받고, 방 코드마다 SQLite 기반 Durable Object 하나가 WebSocket과 게임 상태를 관리합니다. 게임 판정은 기존처럼 호스트 클라이언트가 담당합니다. 싱글 규칙과 특수기물 로직은 변경하지 않았습니다.

## 자동 배치

- `wrangler.jsonc`의 `placement.mode`는 `smart`입니다. 진입 워커의 실행 위치는 Cloudflare가 트래픽에 따라 최적화합니다.
- 방을 만들 때 `locationHint`나 관할권을 지정하지 않습니다. 실제 방 생성 요청에 따라 Durable Object가 자동 배치됩니다.
- 전 세계 방을 한 오브젝트에 모으지 않고, 방마다 별도 오브젝트를 사용합니다.
- 이미 생성한 Durable Object가 플레이 중 다른 지역으로 계속 이동하는 방식은 아닙니다. Smart Placement도 트래픽 분석 전에는 기본 배치를 사용합니다.
- WebSocket Hibernation API를 사용합니다. 생존 확인은 자동 응답하므로 방을 계속 깨우거나 저장소를 쓰지 않습니다.

공식 근거: [Workers Smart Placement](https://developers.cloudflare.com/workers/configuration/placement/), [Durable Object 배치](https://developers.cloudflare.com/durable-objects/reference/data-location/), [WebSocket 휴면](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

## 실행과 배포

이 폴더에서 실행합니다. `Wrangler 4.150.0`에 버전을 고정했습니다. 최초 검증한 최신 버전은 업로드 뒤 공개 주소 조회 단계에서 API 오류를 반환하여, 배포를 완료한 버전을 사용합니다.

```powershell
npm ci
npm start
```

로컬 워커 주소는 `http://localhost:8080`입니다. 게임은 로컬에서 열어도 기본적으로 운영 클플 서버에 접속합니다. 개발용으로 로컬 워커를 사용하려면 `js/multiplayerConfig.js`의 `url`을 `ws://localhost:8080`으로 변경합니다.

```powershell
npm run check
npm run deploy
```

처음 배포할 계정에서는 `npx wrangler login`이 필요합니다. SQLite 기반 Durable Objects는 무료 플랜을 지원하지만 요청·저장소·실행량 제한은 적용됩니다. [요금과 무료 범위](https://developers.cloudflare.com/durable-objects/platform/pricing/)

프런트엔드 운영 서버 주소는 `js/multiplayerConfig.js`에서 관리합니다. 이전 기본 Render 주소가 브라우저에 저장되어 있어도 클플 기본 주소로 전환합니다. 직접 지정한 다른 서버 주소는 유지합니다. 서버 또는 전송 방식이 바뀌면 이전 서버의 방 세션은 재사용하지 않습니다.

서버 배포는 게임 HTML·JS를 다른 웹 호스팅에 올리는 작업과 별개입니다. 이미 게시한 게임 사이트에도 적용하려면 `index.html`, `js/multiplayer.js`, `js/multiplayerConfig.js` 변경을 함께 반영해야 합니다.

## 유지한 기능

- 6자리 방 코드, 호스트·게스트·관전자
- 정원이 찼거나 게스트 재접속을 기다리는 방에 입장하면 관전자로 전환; 관전 버튼으로 직접 입장도 가능
- 호스트 상태 저장·전달, 게스트 행동 전달, 관전자 상태 수신
- 채팅 200자 제한, 궤도 타격 연출 결과 전달
- 호스트·게스트 연결 종료 후 2분 재접속 유예
- 휴면 후 저장소와 WebSocket attachment에서 상태·세션 복원
- 만료된 방·예약 정리, 나간 게스트의 빈자리 재사용

관전자는 연결을 복구할 때 새 관전 세션을 발급받습니다. 빈 방 예약과 재접속 유예는 `setTimeout` 대신 Durable Object 알람으로 처리합니다.

운영 프로토콜은 `POST /rooms`로 코드를 예약한 다음 `/rooms/{코드}`의 WebSocket에 접속합니다. 예약 생성 토큰과 실제 플레이어 세션 토큰은 구분하며, 상태 수정은 호스트, 행동 전달은 게스트만 할 수 있습니다.

이전 Node 서버는 `npm run start:node`로 실행할 수 있습니다. 클라이언트의 `window.MULTIPLAYER_SERVER_TRANSPORT = "node"`와 별도 서버 주소를 명시해야 합니다. 이전 서버나 Render 리소스를 자동으로 삭제하지 않습니다.

## 검증

```powershell
npm test
```

서버 상태·알람·권한, 클라이언트 연결, 무승부 턴 제한과 관전 상태 적용을 검사하는 테스트 26개가 통과했습니다. 아래 통합 검사는 실행 중인 Wrangler나 배포된 서버에 실제 HTTP·WebSocket으로 접속해 테스트 방을 만듭니다.

```powershell
# 별도 창에서 로컬 워커를 실행한 다음 검사합니다.
npx wrangler dev --ip 127.0.0.1 --port 8787
npm run test:integration

# 운영 서버 검사
$env:CHESS_TEST_SERVER_URL = 'https://capitalist-chess.gwonoheon1.workers.dev'
npm run test:integration
```

운영 서버에서는 HTTP·CORS, 정원 초과 입장의 자동 관전과 관전 직접 입장, 상태·행동·채팅·궤도 결과, 게스트 재접속, 방 격리, 게임의 실제 `MultiplayerClient` 연결까지 통합 검사 5개가 통과했습니다. 기존 체스 규칙·특수기물 검사 93개도 통과했습니다. 이전 서버 전환 시에는 로컬 런타임 통합 검사 5개도 통과했습니다.

휴면 후 재생성과 2분 만료는 저장소·알람 모형으로 검사했습니다. 실제 클라우드에서 강제 휴면을 유도했거나 브라우저 두 창으로 전체 대국을 마쳤다는 의미는 아닙니다.
