# Hyperledger Fabric DID Demo (간소화 버전)

This project demonstrates a simple DID (Decentralized Identity) implementation using CouchDB and Node.js.

## Overview

이 시스템은 다음과 같은 구성을 가집니다:
- **정부 노드 (Government BP Node)**: 사용자 신원 정보를 등록하고 검증합니다 (이름, 나이, 성별, 직업)
- **은행 노드 (Bank Read Node)**: 권한이 부여된 사용자 정보만 접근할 수 있습니다 (이름, 나이만)
- **사용자 (User)**: 자신의 DID를 등록하고 데이터 공유 권한을 관리합니다

## 프로젝트 구조

```
hyperledger-did-demo/
├── api/                         # Backend API services
│   ├── government-api/          # Government API service
│   │   ├── package.json         # Node.js dependencies
│   │   └── src/                 # Source code
│   │       └── app.js           # Express application
│   └── bank-api/                # Bank API service
│       ├── package.json         # Node.js dependencies
│       └── src/                 # Source code
│           └── app.js           # Express application
├── docker/                      # Docker configuration
│   └── docker-compose-db.yaml   # Database service definition
└── postman/                     # Postman collection for testing
    └── did-demo.json            # API request examples
```

## 필수 조건

- Docker와 Docker Compose
- Node.js v14 이상
- npm
- Git

## 설치 및 실행 방법

1. 저장소 복제:
   ```
   git clone https://github.com/yourusername/hyperledger-did-demo.git
   cd hyperledger-did-demo
   ```

2. 의존성 패키지 설치:
   ```
   cd api/government-api
   npm install
   
   cd ../bank-api
   npm install
   ```

3. CouchDB 데이터베이스 시작:
   ```
   cd ../../docker
   docker-compose -f docker-compose-db.yaml up -d
   ```

4. API 서버 실행 (별도의 터미널에서):
   ```
   # 첫 번째 터미널에서
   cd ../api/government-api
   node src/app.js
   
   # 두 번째 터미널에서
   cd ../api/bank-api
   node src/app.js
   ```

5. API 서버는 다음 주소에서 접근할 수 있습니다:
   - 정부 API: http://localhost:3001
   - 은행 API: http://localhost:3002

## API 엔드포인트

### 정부 API (Government API)

- `GET /api/health`: 서버 상태 확인
  - 응답: `{ "status": "UP", "service": "Government API" }`

- `POST /api/did/register`: 새로운 사용자 신원 등록
  - 요청 본문: `{ "userId": "user123", "name": "홍길동", "age": 30, "gender": "남성", "occupation": "개발자" }`

- `GET /api/did/:userId`: 사용자 신원 정보 조회
  - 응답: `{ "userId": "user123", "name": "홍길동", "age": 30, "gender": "남성", "occupation": "개발자" }`

- `POST /api/did/authorize`: 기관에 접근 권한 부여
  - 요청 본문: `{ "userId": "user123", "orgId": "BankMSP", "attributes": ["name", "age"] }`

- `POST /api/did/revoke`: 접근 권한 취소
  - 요청 본문: `{ "userId": "user123", "orgId": "BankMSP" }`

### 은행 API (Bank API)

- `GET /api/health`: 서버 상태 확인
  - 응답: `{ "status": "UP", "service": "Bank API" }`

- `GET /api/user/:userId`: 권한 있는 사용자 정보만 조회 (이름, 나이)
  - 필요 헤더: `Authorization: Bearer dummyToken`
  - 응답: `{ "userId": "user123", "name": "홍길동", "age": 30 }`

- `POST /api/user/request-access`: 사용자 정보 접근 요청
  - 요청 본문: `{ "userId": "user123" }`

## 사용 흐름 (Flow)

1. 사용자가 정부 API를 통해 신원 정보를 등록합니다
2. 은행에서 특정 사용자 정보에 접근하려고 시도하면 접근이 거부됩니다
3. 사용자가 정부 API를 통해 은행에게 특정 속성(이름, 나이)에 대한 접근 권한을 부여합니다
4. 은행이 다시 사용자 정보를 요청하면 이번에는 권한이 부여된 속성(이름, 나이)만 조회할 수 있습니다

## Postman 컬렉션으로 테스트하기

Postman 컬렉션(`postman/did-demo.json`)을 가져와서 API를 테스트할 수 있습니다.