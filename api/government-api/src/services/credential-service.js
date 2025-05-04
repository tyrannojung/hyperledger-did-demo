'use strict';

const didUtils = require('../utils/did-utils');

/**
 * Create a verifiable credential
 * @param {string} did - The DID of the subject
 * @param {Object} claims - The credential claims
 * @param {string} issuerDid - The DID of the issuer
 * @param {string} issuerPrivateKey - The private key of the issuer
 * @returns {Object} The verifiable credential
 */
function createVerifiableCredential(did, claims, issuerDid, issuerPrivateKey) {
    const timestamp = new Date().toISOString();
    const id = `${did}#vc-${Date.now()}`;
    
    // Create credential
    const credential = {
        '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://www.w3.org/2018/credentials/examples/v1'
        ],
        id,
        type: ['VerifiableCredential', 'IdentityCredential'],
        issuer: issuerDid,
        issuanceDate: timestamp,
        expirationDate: new Date(Date.now() + 31536000000).toISOString(), // 1 year
        credentialSubject: {
            id: did,
            ...claims
        }
    };
    
    // Generate proof for the credential
    const proof = createCredentialProof(credential, issuerPrivateKey);
    
    return {
        ...credential,
        proof
    };
}

/**
 * Create a proof for a verifiable credential
 * @param {Object} credential - The credential to prove
 * @param {string} privateKey - The private key of the issuer
 * @returns {Object} The proof
 */
function createCredentialProof(credential, privateKey) {
    const timestamp = new Date().toISOString();
    
    // In a real implementation, this would be a proper cryptographic signature
    // over the canonical form of the credential
    const proofValue = require('crypto')
        .createHash('sha256')
        .update(JSON.stringify(credential))
        .digest('hex');
    
    return {
        type: 'Secp256k1Signature2018',
        created: timestamp,
        verificationMethod: `${credential.issuer}#key-1`,
        proofPurpose: 'assertionMethod',
        proofValue: require('base64url').encode(proofValue)
    };
}

/**
 * Create a presentation for selective disclosure
 * @param {string} did - The DID of the holder
 * @param {Array} credentials - The credentials to include
 * @param {Array} disclosureAttributes - The attributes to disclose
 * @param {string} privateKey - The private key of the holder
 * @returns {Object} The verifiable presentation
 */
function createVerifiablePresentation(did, credentials, disclosureAttributes, privateKey) {
    const timestamp = new Date().toISOString();
    const id = `${did}#vp-${Date.now()}`;
    
    // Filter credentials to only include specified attributes
    const filteredCredentials = credentials.map(credential => {
        const filtered = {
            ...credential,
            credentialSubject: {
                id: credential.credentialSubject.id
            }
        };
        
        disclosureAttributes.forEach(attr => {
            if (credential.credentialSubject[attr] !== undefined) {
                filtered.credentialSubject[attr] = credential.credentialSubject[attr];
            }
        });
        
        return filtered;
    });
    
    // Create presentation
    const presentation = {
        '@context': [
            'https://www.w3.org/2018/credentials/v1'
        ],
        id,
        type: 'VerifiablePresentation',
        holder: did,
        verifiableCredential: filteredCredentials
    };
    
    // Generate proof for the presentation
    const proof = createPresentationProof(presentation, privateKey);
    
    return {
        ...presentation,
        proof
    };
}

/**
 * Create a proof for a verifiable presentation
 * @param {Object} presentation - The presentation to prove
 * @param {string} privateKey - The private key of the holder
 * @returns {Object} The proof
 */
function createPresentationProof(presentation, privateKey) {
    const timestamp = new Date().toISOString();
    
    // In a real implementation, this would be a proper cryptographic signature
    const proofValue = require('crypto')
        .createHash('sha256')
        .update(JSON.stringify(presentation))
        .digest('hex');
    
    return {
        type: 'Secp256k1Signature2018',
        created: timestamp,
        verificationMethod: `${presentation.holder}#key-1`,
        proofPurpose: 'authentication',
        proofValue: require('base64url').encode(proofValue)
    };
}

/**
 * Verify a credential
 * @param {Object} credential - The credential to verify
 * @returns {boolean} True if valid, false otherwise
 */
function verifyCredential(credential) {
    // In a real implementation, this would verify the cryptographic proof
    return true;
}

/**
 * Verify a presentation
 * @param {Object} presentation - The presentation to verify
 * @returns {boolean} True if valid, false otherwise
 */
function verifyPresentation(presentation) {
    // In a real implementation, this would verify the cryptographic proof
    // and also verify each credential in the presentation
    return true;
}

module.exports = {
    createVerifiableCredential,
    createVerifiablePresentation,
    verifyCredential,
    verifyPresentation
};