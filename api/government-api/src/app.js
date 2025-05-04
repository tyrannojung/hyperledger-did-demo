'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const PouchDB = require('pouchdb');
const didUtils = require('./utils/did-utils');
const credentialService = require('./services/credential-service');

// Constants
const PORT = 3001;
const HOST = '0.0.0.0';

// Government DID and keys (would be securely stored in a production environment)
const GOVERNMENT_DID = 'did:example:government';
const GOVERNMENT_PRIVATE_KEY = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';

// Initialize express app
const app = express();

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Setup database connection
const didDB = new PouchDB('http://admin:adminpw@localhost:5984/did_db');
const credentialDB = new PouchDB('http://admin:adminpw@localhost:5984/credential_db');
const authorizationDB = new PouchDB('http://admin:adminpw@localhost:5984/authorization_db');

// Initialize databases
(async () => {
    try {
        await didDB.info();
        await credentialDB.info();
        await authorizationDB.info();
        console.log('Databases initialized successfully');
    } catch (error) {
        console.error(`Failed to initialize databases: ${error}`);
    }
})();

// Define routes

// Health check
app.get('/api/health', (req, res) => {
    res.status(200).send({ status: 'UP', service: 'Government API' });
});

// Register a new DID
app.post('/api/did/register', async (req, res) => {
    try {
        const { name, age, gender, occupation } = req.body;
        
        if (!name || !age || !gender || !occupation) {
            return res.status(400).send({ error: 'Missing required fields' });
        }
        
        // Generate a new DID and key pair
        const didInfo = didUtils.generateDid();
        const keyPair = didUtils.generateKeyPair();
        
        // Create personal data object
        const personalData = {
            name,
            age: parseInt(age),
            gender,
            occupation
        };
        
        // Create DID Document according to W3C spec
        const didDocumentInfo = didUtils.createDidDocument(
            didInfo.did,
            keyPair,
            personalData
        );
        
        // Create verifiable credential for the personal data
        const verifiableCredential = credentialService.createVerifiableCredential(
            didInfo.did,
            personalData,
            GOVERNMENT_DID,
            GOVERNMENT_PRIVATE_KEY
        );
        
        // Store DID Document in database
        await didDB.put({
            _id: didInfo.did,
            didDocument: didDocumentInfo.didDocument,
            proof: didDocumentInfo.proof,
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        });
        
        // Store credential in database
        await credentialDB.put({
            _id: `${didInfo.did}-credentials`,
            did: didInfo.did,
            credential: verifiableCredential,
            issued: new Date().toISOString()
        });
        
        // Return DID and private key (in a real system, the private key would be securely delivered to the user)
        res.status(201).send({
            did: didInfo.did,
            didDocument: didDocumentInfo.didDocument,
            privateKey: keyPair.privateKey, // WARNING: In production, never send private keys over HTTP!
            credential: verifiableCredential
        });
    } catch (error) {
        console.error(`Failed to register DID: ${error}`);
        res.status(500).send({ error: error.message });
    }
});

// Resolve a DID to get the DID Document
app.get('/api/did/:did', async (req, res) => {
    try {
        const { did } = req.params;
        
        // Validate DID format
        if (!did.startsWith('did:')) {
            return res.status(400).send({ error: 'Invalid DID format. Must start with "did:"' });
        }
        
        // Retrieve DID document from database
        try {
            const didRecord = await didDB.get(did);
            res.status(200).send(didRecord.didDocument);
        } catch (error) {
            if (error.name === 'not_found') {
                return res.status(404).send({ error: `DID ${did} not found` });
            }
            throw error;
        }
    } catch (error) {
        console.error(`Failed to resolve DID: ${error}`);
        res.status(500).send({ error: error.message });
    }
});

// Get all verifiable credentials for a DID
app.get('/api/credentials/:did', async (req, res) => {
    try {
        const { did } = req.params;
        
        // Retrieve credentials from database
        try {
            const credentialRecord = await credentialDB.get(`${did}-credentials`);
            res.status(200).send(credentialRecord.credential);
        } catch (error) {
            if (error.name === 'not_found') {
                return res.status(404).send({ error: `No credentials found for DID ${did}` });
            }
            throw error;
        }
    } catch (error) {
        console.error(`Failed to get credentials: ${error}`);
        res.status(500).send({ error: error.message });
    }
});

// List all DIDs
app.get('/api/did', async (req, res) => {
    try {
        const result = await didDB.allDocs({
            include_docs: true,
            attachments: false
        });
        
        const dids = result.rows.map(row => ({
            did: row.id,
            didDocument: row.doc.didDocument
        }));
        
        res.status(200).send(dids);
    } catch (error) {
        console.error(`Failed to list DIDs: ${error}`);
        res.status(500).send({ error: error.message });
    }
});

// Authorize selective disclosure of credentials to an organization
app.post('/api/did/authorize', async (req, res) => {
    try {
        const { did, orgId, attributes } = req.body;
        
        if (!did || !orgId || !attributes || !Array.isArray(attributes)) {
            return res.status(400).send({ error: 'Missing or invalid required fields' });
        }
        
        // Check if DID exists
        try {
            await didDB.get(did);
        } catch (error) {
            if (error.name === 'not_found') {
                return res.status(404).send({ error: `DID ${did} not found` });
            }
            throw error;
        }
        
        // Get the credential for the DID
        let credential;
        try {
            const credentialRecord = await credentialDB.get(`${did}-credentials`);
            credential = credentialRecord.credential;
        } catch (error) {
            if (error.name === 'not_found') {
                return res.status(404).send({ error: `No credentials found for DID ${did}` });
            }
            throw error;
        }
        
        // Validate attributes - check they exist in the credential
        const validAttrs = Object.keys(credential.credentialSubject).filter(key => key !== 'id');
        for (const attr of attributes) {
            if (!validAttrs.includes(attr)) {
                return res.status(400).send({ 
                    error: `Invalid attribute: ${attr}`, 
                    validAttributes: validAttrs 
                });
            }
        }
        
        // Create authorization
        const authorization = {
            _id: `${did}-${orgId}`,
            did,
            orgId,
            attributes,
            issuer: GOVERNMENT_DID,
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours
            type: 'VerifiablePresentation'
        };
        
        // Store authorization in database
        await authorizationDB.put(authorization);
        
        // Create a verifiable presentation with only the authorized attributes
        const presentation = credentialService.createVerifiablePresentation(
            did,
            [credential],
            attributes,
            GOVERNMENT_PRIVATE_KEY // In reality, this would be the user's private key
        );
        
        // Update the authorization with the presentation
        authorization._rev = (await authorizationDB.get(`${did}-${orgId}`))._rev;
        authorization.presentation = presentation;
        await authorizationDB.put(authorization);
        
        res.status(200).send({
            message: `Access granted to ${orgId} for DID ${did}`,
            details: authorization,
            presentation
        });
    } catch (error) {
        console.error(`Failed to authorize access: ${error}`);
        res.status(500).send({ error: error.message });
    }
});

// Revoke an authorization
app.post('/api/did/revoke', async (req, res) => {
    try {
        const { did, orgId } = req.body;
        
        if (!did || !orgId) {
            return res.status(400).send({ error: 'Missing required fields' });
        }
        
        // Check if authorization exists
        const authId = `${did}-${orgId}`;
        try {
            const authDoc = await authorizationDB.get(authId);
            await authorizationDB.remove(authDoc);
        } catch (error) {
            if (error.name === 'not_found') {
                return res.status(404).send({ error: `No authorization found for ${orgId} on DID ${did}` });
            }
            throw error;
        }
        
        res.status(200).send({
            message: `Access revoked from ${orgId} for DID ${did}`
        });
    } catch (error) {
        console.error(`Failed to revoke access: ${error}`);
        res.status(500).send({ error: error.message });
    }
});

// Start the server
app.listen(PORT, HOST, () => {
    console.log(`Government API running on http://${HOST}:${PORT}`);
});