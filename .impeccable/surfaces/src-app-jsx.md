---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: ["src/components/v2"]
---

# Surface brief: 세이프맵 앱 화면 전체 (src/App.jsx)

Mode: Operate. 응급 목격자가 한 손으로 가장 가까운 AED를 찾아 가는 작업 화면. 판단 우선순위: 1 직관성, 2 실용성·간단명료.

Scope: 첫 화면(지도+하단 시트), 위치 권한·거부, 운영시간 미확인/닫힘, 길안내, 도착 안내, CPR, 목록, 대피소 모드, 출처 안내, 설치 안내, 오프라인. 서버·데이터·카카오 지도·티맵 경로·기능은 그대로.

Confirmed decisions: AED 기본, 대피소 별도 모드. 첫 그림 뒤 자동 교체 금지. 확실히 열린 AED가 미확인 AED보다 도보 2분 이내로 더 멀면 열린 AED를 기본 답으로. AED 빨강, 119 먹색+빨간 전화 아이콘. 부드러운 해요체.

Open: 위치 공유 방식(Web Share API 우선, 미지원 시 링크 복사로 구현), 발표용 데스크톱 배치(왼쪽 패널).

## Direction contract

THESIS: 응급 지도를 토스식 "큰 한 줄 답"과 네이버 지도식 정돈된 장소 상자로 말한다. 기능마다 색 상자·배지·이모지를 다는 카테고리 기본값을 거부하고, 한 화면에 답 하나와 행동 넷(119·안내·CPR·부탁)만 둔다.

OWN-WORLD: 흰 시트와 회색 단계(#191F28 먹색, #4E5968, #8B95A1, #E5E8EB, #F2F4F6), AED 빨강 #E5304A(핀·경로·주 버튼만), 119는 먹색 버튼+빨간 전화 아이콘, 내 위치만 파랑. 모서리 18px(시트 28px), 그림자 하나, Pretendard 4단계(15/17/19/27), Lucide 선 아이콘, 이모지 0.

STORY: 열자마자 "가장 가까운 AED까지 걸어서 약 2분"을 읽고, 건물 안 위치를 확인하고, 안내를 시작하거나 119·CPR·부탁 중 하나를 누른다. 불확실하면 숨기지 않고 다음 행동을 제안한다.

FIRST VIEWPORT: 위 떠 있는 바(AED|대피소 전환, 검색). 지도에 내 위치(파랑)와 가장 가까운 AED 빨간 핀(56px), 연한 빨강 경로와 "도보 약 2분" 말풍선, 나머지 AED는 작은 연분홍 점. 아래 시트: 27px 한 줄 답, 회색 장소 상자(건물 안 위치 19px + 거리·건물·상태), [119 100px][안내 시작], [CPR 도와줘요][옆 사람에게 부탁].

FORM: 카테고리 표준(standing exit), 네이버 지도·토스 완성도 기준, 사용자 수정(AED 빨강, 부드러움) 반영. seed:d70c342fa5c77506. 시그니처: 시트 맨 위 큰 한 줄 답 + 지도 위 경로 시간 말풍선.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
