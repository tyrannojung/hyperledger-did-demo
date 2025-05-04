# Hyperledger Fabric DID Demo (W3C Standards Compliant)

This project demonstrates a W3C-compliant Decentralized Identity (DID) implementation using CouchDB and Node.js.

## Overview

This system consists of:

- **Government Node**: Issues and validates W3C-compliant DIDs and Verifiable Credentials (name, age, gender, occupation)
- **Bank Node**: Verifies and accesses selective data with user authorization (only name and age)
- **User**: Controls their DID and authorizes selective disclosure

## W3C DID Features Implemented

- **Standard DID Syntax**: Uses the `did:method:identifier` syntax
- **W3C DID Documents**: Properly structured with contexts, verification methods, authentication, etc.
- **Verifiable Credentials**: Issues and manages W3C-compliant credentials
- **Verifiable Presentations**: Supports selective disclosure of attributes
- **Proof and Signatures**: Includes cryptographic proofs in DID documents and credentials

## Project Structure

```
hyperledger-did-demo/
├── api/                         # Backend API services
│   ├── government-api/          # Government API service
│   │   ├── package.json         # Node.js dependencies
│   │   └── src/                 # Source code
│   │       ├── app.js           # Express application
│   │       ├── utils/           # Utility functions
│   │       │   └── did-utils.js # DID creation and management utilities
│   │       └── services/        # Service modules
│   │           └── credential-service.js # Credential management
│   └── bank-api/                # Bank API service
│       ├── package.json         # Node.js dependencies
│       └── src/                 # Source code
│           └── app.js           # Express application
├── docker/                      # Docker configuration
│   └── docker-compose-db.yaml   # Database service definition
└── postman/                     # Postman collections for testing
    └── did-demo-w3c.json        # W3C-compliant API request examples
```

## Prerequisites

- Docker and Docker Compose
- Node.js v14+
- npm
- Git

## Setup Instructions

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/hyperledger-did-demo.git
   cd hyperledger-did-demo
   ```

2. Install dependencies:

   ```
   cd api/government-api
   npm install

   cd ../bank-api
   npm install
   ```

3. Start CouchDB databases:

   ```
   cd ../../docker
   docker-compose -f docker-compose-db.yaml up -d
   ```

4. Start API servers (in separate terminals):

   ```
   # First terminal
   cd ../api/government-api
   node src/app.js

   # Second terminal
   cd ../api/bank-api
   node src/app.js
   ```

5. API endpoints are available at:
   - Government API: http://localhost:3001
   - Bank API: http://localhost:3002

## W3C DID API Endpoints

### Government API

- `GET /api/health`: Health check

  - Response: `{ "status": "UP", "service": "Government API" }`

- `POST /api/did/register`: Register a new DID

  - Request: `{ "name": "John Doe", "age": 30, "gender": "Male", "occupation": "Engineer" }`
  - Response: `{ "did": "did:example:123...", "didDocument": {...}, "privateKey": "...", "credential": {...} }`

- `GET /api/did/:did`: Resolve a DID to get its DID Document

  - Response: W3C-compliant DID Document

- `GET /api/credentials/:did`: Get verifiable credentials for a DID

  - Response: W3C-compliant Verifiable Credential

- `GET /api/did`: List all DIDs registered with the government

  - Response: Array of DIDs

- `POST /api/did/authorize`: Authorize selective disclosure

  - Request: `{ "did": "did:example:123...", "orgId": "BankMSP", "attributes": ["name", "age"] }`
  - Response: `{ "message": "Access granted...", "details": {...}, "presentation": {...} }`

- `POST /api/did/revoke`: Revoke authorization
  - Request: `{ "did": "did:example:123...", "orgId": "BankMSP" }`

### Bank API

- `GET /api/health`: Health check

  - Response: `{ "status": "UP", "service": "Bank API" }`

- `GET /api/user/:did`: Get user data with selective disclosure

  - Headers: `Authorization: Bearer token`
  - Response: `{ "holder": "did:example:123...", "attributes": { "name": "John Doe", "age": 30 }, ... }`

- `POST /api/user/request-access`: Request access to user data

  - Request: `{ "did": "did:example:123..." }`
  - Response: Instructions for authorization

- `POST /api/verify/presentation`: Verify a verifiable presentation
  - Request: `{ "presentation": {...} }`
  - Response: `{ "valid": true, ... }`

## Flow Example

1. Register a DID with the Government

```
POST http://localhost:3001/api/did/register
{
    "name": "John Doe",
    "age": 30,
    "gender": "Male",
    "occupation": "Engineer"
}
```

2. Bank requests access to the DID's data

```
POST http://localhost:3002/api/user/request-access
{
    "did": "did:example:123456789abcdefghi"
}
```

3. User authorizes Bank to access only name and age

```
POST http://localhost:3001/api/did/authorize
{
    "did": "did:example:123456789abcdefghi",
    "orgId": "BankMSP",
    "attributes": ["name", "age"]
}
```

4. Bank accesses the authorized data

```
GET http://localhost:3002/api/user/did:example:123456789abcdefghi
Authorization: Bearer dummyToken
```

## Testing with Postman

Import the Postman collection from `postman/did-demo-w3c.json` to test the W3C-compliant API endpoints. This collection includes all the necessary requests for testing both the Government and Bank API services.

## Security Notes

- This demo implements simplified cryptographic signing and verification for demonstration purposes.
- In a production environment, proper key management and secure communication would be implemented.
- The private keys should never be exposed in API responses as they are in this demo.
