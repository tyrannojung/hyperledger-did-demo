'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const EC = require('elliptic').ec;
const base64url = require('base64url');
const jwt = require('jsonwebtoken');

// Initialize elliptic curve for key generation
const ec = new EC('secp256k1');

// DID method name
const DID_METHOD = 'example';

/**
 * Generate a new DID with format did:method:identifier
 * @returns {Object} An object containing the DID and its components
 */
function generateDid() {
    const uniqueId = uuidv4().replace(/-/g, '');
    const did = `did:${DID_METHOD}:${uniqueId}`;
    return {
        did,
        method: DID_METHOD,
        identifier: uniqueId
    };
}

/**
 * Generate a key pair for DID authentication and verification
 * @returns {Object} An object containing public and private keys
 */
function generateKeyPair() {
    // Generate new key pair
    const keyPair = ec.genKeyPair();
    
    // Get public and private keys
    const privateKeyHex = keyPair.getPrivate('hex');
    const publicKeyHex = keyPair.getPublic('hex');
    
    // Convert to base64url encoding for inclusion in DID Document
    const privateKeyBase64 = base64url.encode(Buffer.from(privateKeyHex, 'hex'));
    const publicKeyBase64 = base64url.encode(Buffer.from(publicKeyHex, 'hex'));
    
    return {
        privateKey: privateKeyHex,
        publicKey: publicKeyHex,
        privateKeyBase64,
        publicKeyBase64
    };
}

/**
 * Create a verification method entry for a DID document
 * @param {string} did - The DID
 * @param {string} keyId - The key ID
 * @param {string} publicKeyBase64 - The public key in base64url encoding
 * @returns {Object} The verification method object
 */
function createVerificationMethod(did, keyId, publicKeyBase64) {
    return {
        id: `${did}#${keyId}`,
        type: 'Secp256k1VerificationKey2018',
        controller: did,
        publicKeyBase64
    };
}

/**
 * Create a W3C-compliant DID Document
 * @param {string} did - The DID
 * @param {Object} keyPair - The key pair
 * @param {Object} personalData - Personal data to include (name, age, etc.)
 * @returns {Object} The DID Document
 */
function createDidDocument(did, keyPair, personalData) {
    const timestamp = new Date().toISOString();
    const keyId = 'key-1';
    
    // Create verification method
    const verificationMethod = createVerificationMethod(
        did,
        keyId,
        keyPair.publicKeyBase64
    );
    
    // Create the DID Document according to W3C spec
    const didDocument = {
        '@context': [
            'https://www.w3.org/ns/did/v1',
            'https://w3id.org/security/suites/secp256k1-2019/v1'
        ],
        id: did,
        controller: did,
        verificationMethod: [verificationMethod],
        authentication: [`${did}#${keyId}`],
        assertionMethod: [`${did}#${keyId}`],
        service: [
            {
                id: `${did}#government-service`,
                type: 'GovernmentVerificationService',
                serviceEndpoint: 'https://government.example/verify'
            }
        ],
        created: timestamp,
        updated: timestamp
    };
    
    // Create a separate credentials document for personal data
    const credentialsDocument = {
        '@context': [
            'https://www.w3.org/2018/credentials/v1'
        ],
        id: `${did}#credentials`,
        type: ['VerifiableCredential', 'IdentityCredential'],
        issuer: 'did:example:government',
        issuanceDate: timestamp,
        credentialSubject: {
            id: did,
            ...personalData
        }
    };
    
    // Create a proof for the DID document (simplified example)
    const proof = createProof(did, keyPair.privateKey);
    
    return {
        didDocument,
        credentialsDocument,
        proof,
        privateKey: keyPair.privateKey
    };
}

/**
 * Create a proof for a DID document
 * @param {string} did - The DID
 * @param {string} privateKey - The private key
 * @returns {Object} The proof object
 */
function createProof(did, privateKey) {
    const timestamp = new Date().toISOString();
    
    // In a real implementation, this would create a cryptographic signature
    // Here we do a simple hash just for demonstration
    const proofValue = crypto
        .createHash('sha256')
        .update(`${did}:${timestamp}:${privateKey.substring(0, 10)}`)
        .digest('hex');
    
    return {
        type: 'Secp256k1Signature2018',
        created: timestamp,
        verificationMethod: `${did}#key-1`,
        proofPurpose: 'assertionMethod',
        proofValue: base64url.encode(proofValue)
    };
}

/**
 * Verify a DID proof
 * @param {string} did - The DID
 * @param {Object} proof - The proof object
 * @param {Object} didDocument - The DID document
 * @returns {boolean} True if valid, false otherwise
 */
function verifyProof(did, proof, didDocument) {
    // This is a simplified example. In a real implementation,
    // you would verify the cryptographic signature
    return true;
}

/**
 * Create a JWT for selective disclosure
 * @param {string} did - The DID
 * @param {string} privateKey - The private key
 * @param {Object} claims - The claims to include
 * @returns {string} The JWT
 */
function createSelectiveDisclosureJwt(did, privateKey, claims) {
    const payload = {
        iss: did,
        sub: did,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
        claims
    };
    
    // In a real implementation, you would sign this with the private key
    // Here we use a symmetric key for simplicity
    const token = jwt.sign(payload, privateKey.substring(0, 32));
    
    return token;
}

module.exports = {
    generateDid,
    generateKeyPair,
    createDidDocument,
    createVerificationMethod,
    createProof,
    verifyProof,
    createSelectiveDisclosureJwt
};