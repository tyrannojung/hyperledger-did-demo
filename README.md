# hyperledger-did-demo

A complete backend-only demonstration of a Decentralized Identifier (DID) system using Hyperledger Indy and TypeScript.
This project simulates a real-world flow with government, user, and bank roles — tested entirely via Postman.

## 🧭 Overview

This system includes:

- ✅ A government (issuer) issuing identity credentials
- ✅ A user (holder) who stores and presents credentials
- ✅ A bank (verifier) verifying proofs with selective disclosure
- ✅ Indy pool network simulated with Docker
- ✅ Postman collection for testing full credential lifecycle

No frontend is required — all interactions are tested via API.

## 📁 Folder Structure

```
did-backend/
├── src/
│   ├── config/           # Environment and Indy config
│   ├── controllers/      # API controllers for each role
│   ├── models/           # In-memory models for wallets, credentials
│   ├── routes/           # Express route definitions
│   ├── services/         # Indy SDK integration
│   ├── middlewares/      # Error handling, logging
│   └── app.ts            # App entry point
├── docker/
│   ├── docker-compose.yml    # Indy pool setup
│   └── indy-pool.dockerfile  # 4-node Indy pool
├── scripts/
│   └── setup-pool.ts         # Genesis txns + Steward DID setup
├── postman/
│   └── did-api.postman_collection.json
├── .env
├── tsconfig.json
├── package.json
└── README.md
```

## ⚙️ Getting Started

1. Clone the repo

```bash
git clone https://github.com/your-org/hyperledger-did-demo.git
cd hyperledger-did-demo
```

2. Install dependencies

```bash
npm install
```

3. Build the TypeScript project

```bash
npm run build
```

4. Start Indy pool network (Docker)

```bash
cd docker
docker-compose up -d
```

After booting, copy the genesis file:

```bash
docker cp indy-pool:/var/lib/indy/sandbox/pool_transactions_genesis ../pool_transactions_genesis
```

5. Setup Steward (trust anchor) and close pool

```bash
npm run setup-pool
```

6. Start the backend server

```bash
# Development mode
npm run dev

# or production mode
npm start
```

## 🧪 API Testing with Postman

### Import Postman Collection

File: `postman/did-api.postman_collection.json`

### Run the Workflow in This Order:

#### Government (Issuer)

- POST /api/government/setup
- POST /api/government/schema
- POST /api/government/credential-definition
- POST /api/government/credential-offer

#### User (Holder)

- POST /api/user/wallet
- POST /api/user/credential-request
- POST /api/government/issue-credential
- POST /api/user/store-credential

#### Bank (Verifier)

- POST /api/bank/setup
- POST /api/bank/proof-request

#### Proof and Verification

- POST /api/user/create-proof
- POST /api/bank/verify-proof

## 🛠 Technologies Used

- Hyperledger Indy SDK
- Node.js + TypeScript
- Express.js
- Docker + Docker Compose
- Postman

## 🧱 Roles in the System

| Role       | Description                                           |
| ---------- | ----------------------------------------------------- |
| Government | Issues verifiable credentials (DID, schema, VC)       |
| User       | Stores credentials, generates proofs selectively      |
| Bank       | Requests and verifies proofs with specific attributes |

## 📌 DID Credential Example

**Credential Schema:**

- name
- age
- gender
- occupation

**Bank Verification Request:**

- Only name and age
- No access to full credential

## 🔒 Security Notes

This project is for educational/demo purposes.
In production:

- Use secure wallet storage (e.g., libindy with plug-ins or Vault)
- Implement proper authentication on API endpoints
- Encrypt communication with TLS

## 📄 License

MIT License
