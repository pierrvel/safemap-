---
name: 세이프맵
description: 가장 가까운 '지금 쓸 수 있는' AED를 한 줄 답으로 알려 주는 응급 지도
colors:
  aed-red: "#E5304A"
  aed-red-press: "#C9233B"
  aed-pin-soft: "#F3A6B0"
  route-soft: "#F0828F"
  aed-soft: "#FDECEE"
  call-icon: "#FF5A6E"
  user-blue: "#3182F6"
  ink: "#191F28"
  ink-2: "#333D4B"
  gray-1: "#4E5968"
  gray-2: "#6B7684"
  gray-3: "#8B95A1"
  line: "#E5E8EB"
  surface: "#F2F4F6"
  paper: "#FFFFFF"
  map-ground: "#EEF0F2"
typography:
  display:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
    fontSize: "88px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.03em"
  place-title:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  body-lg:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.45
  caption:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  call-number:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
    fontSize: "21px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tnum"
rounded:
  mark: "50%"
  chip: "12px"
  inner: "14px"
  bubble: "16px"
  control: "18px"
  pill: "20px"
  sheet: "28px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-119:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.call-number}"
    rounded: "{rounded.control}"
    height: "58px"
    width: "104px"
  button-go:
    backgroundColor: "{colors.aed-red}"
    textColor: "{colors.paper}"
    typography: "{typography.place-title}"
    rounded: "{rounded.control}"
    height: "58px"
  button-go-active:
    backgroundColor: "{colors.aed-red-press}"
    textColor: "{colors.paper}"
  button-go-disabled:
    backgroundColor: "{colors.line}"
    textColor: "{colors.gray-2}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    height: "58px"
  button-ink-active:
    backgroundColor: "{colors.ink-2}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.control}"
    height: "52px"
  segmented-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.inner}"
  segmented-off:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.gray-2}"
    rounded: "{rounded.inner}"
  floating-control:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    size: "48px"
  search-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 6px 0 16px"
  place-box:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "14px 16px"
  sheet:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.sheet}"
    padding: "8px 20px 16px"
  route-bubble:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.bubble}"
    height: "32px"
    padding: "0 12px"
  nav-banner:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "16px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
---

# Design System: 세이프맵

## Overview

**Creative North Star: "한 줄 답이 있는 지도"**

세이프맵은 당황한 목격자가 한 손으로 보는 지도예요. 화면은 흰 시트와 회색 단계로 조용히 가라앉아 있고, 그 위에서 단 하나의 빨강(AED)이 답을 가리킵니다. 하단 시트 맨 위의 27px 한 줄 답("AED까지 걸어서 약 2분")과 지도 위 경로 시간 말풍선이 이 세계의 서명이에요. 나머지는 모두 그 답을 받쳐 주는 정돈된 상자와 버튼입니다.

밀도는 낮고 터치 영역은 넉넉합니다. 모든 조작은 48px 이상, 주 행동은 58px 높이예요. 모서리는 부드럽게 둥글고(18px, 시트 28px), 그림자는 먹색을 묽게 섞은 짧은 확산 그림자뿐이라 딱딱하지 않고 편안합니다. 카카오 지도 바탕은 채도를 낮춰(`saturate(0.3)`) 핀과 경로가 먼저 보이게 합니다.

기능마다 색 상자·배지·이모지를 다는 카테고리 기본값은 쓰지 않아요. 색은 역할 하나에 하나씩: AED 빨강, 119 먹색, 내 위치 파랑, 나머지는 회색 단계.

**Key Characteristics:**
- 시트 맨 위 큰 한 줄 답 + 지도 위 흰 경로 시간 말풍선
- 색은 역할당 하나: 빨강은 AED(핀·경로·주 버튼), 파랑은 내 위치와 포커스뿐
- 흰 시트, 회색 장소 상자, 먹색과 빨강 두 개의 무거운 버튼
- Pretendard 한 가족, 굵기와 크기만으로 위계
- Lucide 선 아이콘, 이모지 0
- 상태는 색만이 아니라 모양(채운 원 / 빈 원 / 사선 원)으로 구분

## Colors

중립 회색 단계 위에 빨강 하나와 파랑 하나만 얹는 절제된 팔레트예요.

### Primary
- **AED 빨강** (aed-red): 가장 가까운/선택된 AED 핀, 길안내 중 경로선, "안내 시작" 주 버튼, CPR 박자 원, AED 아이콘(하트펄스). 화면에서 답을 가리키는 유일한 채도 높은 색.
- **눌린 AED 빨강** (aed-red-press): 주 버튼을 누르는 순간에만.
- **연한 핀 빨강** (aed-pin-soft): 답이 아닌 나머지 AED를 작은 점(16px)으로 찍을 때.
- **연한 경로 빨강** (route-soft): 길안내 전 미리보기 경로선. 흰 테두리 선(9px) 위에 5px로 겹쳐 그림.
- **아주 연한 빨강** (aed-soft): 텍스트 선택 배경.
- **전화 아이콘 빨강** (call-icon): 먹색 119 버튼 안의 전화 아이콘에만. 어두운 바탕에서 빨강이 살아나도록 한 단계 밝힘.

### Secondary
- **내 위치 파랑** (user-blue): 내 위치 점과 그 주변 옅은 원(16% 불투명), 그리고 키보드 포커스 링(3px). 그 밖에는 쓰지 않음.

### Neutral
- **먹색** (ink): 본문 제목, 119 버튼, 선택된 전환 버튼, 길안내 상단 배너, 토스트, 단계 번호 원, "열림" 상태 표시.
- **진회색** (ink-2): 보조 버튼 글자, 상세 정보 값, 경고 문장, 대피소 강조 핀.
- **회색 1** (gray-1): 보조 문장, 장소 메타, 상태 줄.
- **회색 2** (gray-2): 꺼진 전환 버튼 글자, 자리표시자, 작은 메모, 섹션 머리말.
- **회색 3** (gray-3): 펼침 화살표, "닫힘" 상태 표시, 나머지 대피소 핀, 겹친 시설 분산 점선. 글자색으로는 쓰지 않음.
- **선** (line): 시트 손잡이, 목록 구분선, 대안 상자 테두리(1.5px), 비활성 주 버튼 바탕.
- **표면 회색** (surface): 장소 상자, 보조 버튼, 시트 안 검색 칸, 현재 목록 행, 스켈레톤.
- **종이** (paper): 시트, 떠 있는 조작부, 전체 화면 안내, 대화상자.
- **지도 바탕** (map-ground): 지도가 그려지기 전과 페이지 배경.

### Named Rules
**The One Red Rule.** 빨강은 AED의 답(핀·경로·주 버튼·CPR 박자)에만 씁니다. 경고·오류·배지에 빨강을 쓰지 않아요. 경고는 회색 상자(surface)에 먹색 글로 말합니다.

**The 119 Is Ink Rule.** 119는 언제나 먹색 버튼에 빨간 전화 아이콘. 빨강 주 버튼과 같은 색이 되면 안 되고, 모든 상태에서 같은 자리(행동 줄 왼쪽, 104px)에 있습니다.

**The Blue Is You Rule.** 파랑은 "나"(내 위치)와 포커스 링에만. 링크·버튼·정보 강조에 파랑을 쓰지 않습니다.

## Typography

**Body Font:** Pretendard (with -apple-system, Apple SD Gothic Neo, Malgun Gothic)

**Character:** 한 가족만 씁니다. 위계는 크기와 굵기(400 / 700, 119만 800)로만 만들고, 큰 글자일수록 자간을 조금 좁혀(-0.02~-0.04em) 단단하게 묶어요. `word-break: keep-all`로 한국어 단어가 줄 끝에서 쪼개지지 않게 합니다.

### Hierarchy
- **Display** (700, 88px, 1): CPR 압박 횟수 숫자 하나. 표 숫자(tabular-nums).
- **Headline** (700, 27px, 1.3): 시트 맨 위 한 줄 답, 전체 화면 안내 제목, 길안내 다음 거리. `text-wrap: balance`.
- **Title** (700, 22px, 1.35): 대화상자 제목, 목록 머리말, 길안내 중 남은 거리, CPR 머리말. 한 줄 답보다 한 단계 낮은 제목.
- **Place title** (700, 19px, 1.35): 건물 안 설치 위치. 시트에서 두 번째로 큰 글자이자 주 버튼 글자. 두 줄까지 보이고 잘림.
- **Body large** (400, 17px, 1.5): 한 줄 답 아래 보조 문장, 전체 화면 안내 본문(1.6), 입력 칸, 보조 버튼 글자(700).
- **Body** (400, 15px, 1.5): 기본 본문, 장소 메타, 상세 정보, 상태 줄.
- **Label** (700, 15px): 검색 버튼, 말풍선, 링크형 버튼, 섹션 머리말, 토스트(600).
- **Caption** (500, 13px, 1.5): 출처 메모, 목록 거리 보조, CPR 법적 안내. 가장 작은 글자.
- **Call number** (800, 21px): 119 버튼의 숫자 전용.

### Named Rules
**The Numbers Hold Still Rule.** 거리·시간·횟수처럼 바뀌는 숫자는 모두 `font-variant-numeric: tabular-nums`. 숫자가 바뀌어도 글자 폭이 흔들리지 않게.

**The No Label Above Rule.** 제목 위에 작은 머리표(키커)를 얹지 않습니다. 맥락은 문장 자체가 말해요("AED까지 걸어서 약 2분").

## Layout

지도가 화면 전체(100dvh)를 차지하고, 그 위에 세 층이 떠 있어요. 위: 안전 영역 아래 12px에 떠 있는 바(좌우 16px, 간격 8px: AED|대피소 전환, 검색, 정보). 오른쪽 아래: 48px 떠 있는 조작부 세로 묶음(간격 8px). 아래: 흰 시트(좌우 20px, 안전 영역 + 16px). 시트 높이는 지도 조작부 위치와 화면 맞춤에 전달됩니다.

시트 안 순서는 고정: 손잡이(40×5px) → 한 줄 답 → 장소 상자(위 14px) → 행동 줄 [119 104px | 안내 시작 1fr] → [CPR 도와줘요 | 옆 사람에게 부탁] 2열 → 링크형 버튼. 행동 줄 간격은 8px.

간격 리듬은 4px 단위(4/8/12/16/20/24)이고, 상자 안 여백은 14×16px이 기본입니다. 전체 화면 안내(위치 권한, CPR)는 좌우 24px, 본문 최대 440px, 위 여백 12vh.

**넓은 화면 (≥900px):** 시트는 왼쪽 16px에 떠 있는 400px 패널이 되고 네 모서리 모두 28px로 둥글어집니다. 위 바와 길안내 배너도 400px 폭. 확대·축소 버튼은 이때만 보입니다(휴대폰은 손가락으로 확대). 대화상자는 아래 시트에서 가운데 정렬 카드로, CPR·안내 화면은 가운데 440px 열로 바뀝니다.

## Elevation & Depth

평면 위에 짧고 묽은 그림자로 "떠 있음"만 알립니다. 모든 그림자는 먹색(rgb 25,31,40)을 8~20%로 섞은 부드러운 확산이고, 딱딱한 오프셋 그림자는 없어요. 시트 안의 상자들은 그림자 대신 표면 회색(surface)으로 층을 나눕니다.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 2px 8px rgba(25, 31, 40, 0.10)`): 지도 위 떠 있는 모든 조작부(전환, 검색, 버튼, 재검색 알약, 지도 불가 안내).
- **Sheet** (`box-shadow: 0 -2px 16px rgba(25, 31, 40, 0.08)`): 휴대폰 하단 시트의 윗변.
- **Panel** (`box-shadow: 0 4px 24px rgba(25, 31, 40, 0.12)`): 넓은 화면의 떠 있는 왼쪽 패널.
- **Bubble** (`box-shadow: 0 2px 8px rgba(25, 31, 40, 0.16)`): 지도 위 경로 시간 말풍선. 지도 라벨과 섞이지 않게 Float보다 조금 진함.
- **Banner** (`box-shadow: 0 4px 16px rgba(25, 31, 40, 0.18~0.2)`): 먹색 길안내 배너와 토스트.
- **Beat glow** (`box-shadow: 0 8px 24px rgba(229, 48, 74, 0.25)`): CPR 박자 원 하나에만 쓰는 빨간 빛.

### Named Rules
**The Gray Layer Rule.** 시트 안에서는 그림자를 쓰지 않습니다. 상자는 surface 회색 바탕으로, 대안은 1.5px line 테두리로 구분해요.

## Shapes

부드럽게 둥근 상자가 이 세계의 형태예요. 모든 조작부와 상자는 18px, 시트와 대화상자의 윗모서리는 28px. 상자 안의 작은 요소는 한 단계 작게(전환 버튼·닫기·현재 목록 행 14px, 검색 제출 12px). 알약형은 높이의 절반(재검색 20px, 말풍선 16px). 원은 상태 표시(9px), 단계 번호(28px), 내 위치 점, CPR 박자 원뿐입니다.

지도 핀은 둥근 사각형이에요. 답 핀은 52px 상자(모서리 17px, 흰 테두리 3px)에 흰 하트+번개, 나머지는 16px 연한 점(모서리 6px). 대피소는 같은 형태에 방패 모양, 먹색/회색. 겹친 시설은 26px 상자에 개수.

## Components

### Buttons
무겁고 확실하게. 누르면 살짝 줄어듭니다(`scale(0.98)`, 0.15s).
- **Shape:** 부드럽게 둥근 모서리 (18px), 높이 58px(행동 줄) 또는 52px(보조).
- **119:** 먹색 바탕, 흰 21px/800 숫자, 앞에 빨간(call-icon) 채운 전화 아이콘 20px. 항상 `tel:119` 링크.
- **안내 시작 (Primary):** AED 빨강 바탕에 흰 19px/700 글자. 누르면 aed-red-press. 비활성은 line 바탕에 gray-2 글자.
- **먹색 주 버튼:** 대피소 모드 등 빨강이 맞지 않을 때 같은 형태를 먹색으로. 누르면 ink-2.
- **Secondary:** surface 바탕, ink-2 17px/700. 아이콘 20px 선(굵기 2.2), CPR 아이콘만 빨강.
- **Link button:** 바탕 없이 gray-1 15px/700, 최소 높이 44px, 끝에 작은 화살표.

### Segmented Control (AED | 대피소)
- **Style:** 흰 48px 떠 있는 상자, 안쪽 4px. 켜진 쪽은 먹색 바탕 흰 글자, 꺼진 쪽은 gray-2. 17px/700. 0.2s 색 전환.

### Cards / Containers
- **장소 상자:** surface 바탕, 18px, 안쪽 14×16px. 설치 위치(19px) + 거리·관리기관(15px) + 상태. 오른쪽 펼침 화살표(gray-3)가 180도 돌며 상세 정보(주소·운영시간·위치 메모·카카오맵 링크)를 엽니다.
- **대안 상자:** 바탕 없이 1.5px line 테두리, 18px. "확실히 열려 있는 AED도 있어요"처럼 알리기만 하는 제안.
- **출처 상자 / 경고 상자:** surface 바탕, 18px 또는 14px. 경고도 빨강 없이 먹색 글 + 정보 아이콘.
- **Shadow Strategy:** 시트 안 상자는 그림자 없음 (Gray Layer Rule).

### Inputs / Fields
- **Style:** 지도 위 검색은 흰 48px 떠 있는 상자, 시트·안내 화면 안 검색은 surface 52px. 테두리 없음, 17px, 커서는 AED 빨강. 오른쪽에 먹색 36px 제출 버튼(12px 모서리).
- **Focus:** 전역 포커스 링 3px user-blue, 2px 띄움.

### Navigation (길안내)
- **상단 배너:** 먹색 바탕, 18px, 안쪽 16px. 왼쪽 52px 반투명 흰 상자(12%)에 방향 아이콘 28px, 다음 거리 27px/700, 지시문 17px 흰색 82%. 오른쪽 음성 켜기/끄기 44px.
- **시트:** 22px 남은 거리 + 목적지, 필요할 때 경고 상자, [119 | 안내 끝내기].
- **도착:** 27px "도착했어요." + 장소 상자 + 먹색 번호 원(28px) 단계 목록.

### Status Mark
색만으로 말하지 않는 9px 원: 열림은 먹색 채운 원, 미확인은 먹색 2px 빈 원, 닫힘은 gray-3 테두리에 사선. 옆에 반드시 문장("지금 이용 가능 / 운영시간 확인 안 됨 / 지금은 닫혀 있어요").

### Route Time Bubble (signature)
지도 위 흰 알약(32px, 16px 모서리), 15px/700 먹색 "도보 약 N분", 표 숫자. 경로선은 흰 테두리 선 위에 빨강을 겹쳐 지도 어디서든 읽힙니다.

### CPR Beat
지름 min(64vw, 240px)의 AED 빨강 원 안에 88px 흰 횟수. 박자마다 0.92로 줄었다 돌아옴(0.12s). 아래 2열 조작 버튼과 13px 법적 안내.

### Sheet, Dialog, Toast
- **시트:** 흰 바탕, 윗모서리 28px, 처음 나타날 때 한 번만 아래에서 24px 올라옴(0.36s).
- **대화상자:** 40% 먹색 배경 위 아래 시트(최대 480px), 22px 제목, 17px 리드, 버튼은 세로 가득.
- **토스트:** 위 72px 가운데, 먹색 18px 상자, 15px/600 흰 글자, 위에서 8px 떨어지며 나타남.

### Motion
감속 곡선 하나(`cubic-bezier(0.16, 1, 0.3, 1)`)를 모든 전환에 씁니다. 0.12~0.36s로 짧고, 움직임 줄이기 설정에서는 사실상 꺼집니다. 불러오는 중에는 답이 들어갈 자리에 surface 스켈레톤이 1.4s로 숨쉬듯 흐려졌다 돌아와요.

## Do's and Don'ts

### Do:
- **Do** 시트 맨 위에 27px/700 한 줄 답 하나를 둡니다. 질문 하나에 답 하나.
- **Do** 행동 줄은 [119 104px | 주 버튼 1fr], 높이 58px, 간격 8px로 모든 상태에서 같은 자리에 둡니다.
- **Do** AED 빨강 바탕 위 흰 글자는 19px/700 이상으로만 씁니다(흰색 대비 약 4.4:1, 큰 글자 기준 통과).
- **Do** 상태는 모양이 다른 표시(채운 원 / 빈 원 / 사선 원)와 문장으로 함께 말합니다.
- **Do** 아이콘은 Lucide 선 아이콘(굵기 2~2.2, 18~22px)을 쓰고, 꾸밈 아이콘은 `aria-hidden`.
- **Do** 터치 영역은 44px 이상, 떠 있는 조작부는 48px.
- **Do** 지도 위 요소는 흰 바탕 + Float 그림자, 시트 안 요소는 surface 회색 바탕으로 층을 나눕니다.

### Don't:
- **Don't** 경고·오류·배지·장식에 AED 빨강을 쓰지 마세요. 빨강은 답을 가리킬 때만.
- **Don't** 119 버튼을 빨강으로 만들지 마세요. 먹색 + 빨간 전화 아이콘.
- **Don't** 파랑을 링크나 버튼에 쓰지 마세요. 내 위치와 포커스 전용.
- **Don't** 기능마다 색 상자·배지·이모지를 달지 마세요.
- **Don't** 제목 위에 작은 머리표(키커)를 얹지 마세요.
- **Don't** gray-3을 글자색으로 쓰지 마세요. 아이콘·표시 전용.
- **Don't** 시트 안 상자에 그림자를 주거나, 딱딱한 오프셋 그림자를 쓰지 마세요.
