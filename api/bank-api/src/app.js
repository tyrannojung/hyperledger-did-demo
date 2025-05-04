'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const PouchDB = require('pouchdb');
const crypto = require('crypto');
const base64url = require('base64url');

// Constants
const PORT = 3002;
const HOST = '0.0.0.0';

// Bank DID and keys (would be securely stored in a production environment)
const BANK_DID = 'did:example:bank';
const BANK_ORG_ID = 'BankMSP';

// Initialize express app
const app = express();

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Setup database connection
const bankDB = new PouchDB('http://admin:adminpw@localhost:6984/bank_db');
// Connect to government authorization database (read-only)
const authorizationDB = new PouchDB('http://admin:adminpw@localhost:5984/authorization_db');
const didDB = new PouchDB('http://admin:adminpw@localhost:5984/did_db');
const credentialDB = new PouchDB('http://admin:adminpw@localhost:5984/credential_db');

// Initialize databases
(async () => {
    try {
        await bankDB.info();
        console.log('Bank database initialized successfully');
    } catch (error) {
        console.error(`Failed to initialize bank database: ${error}`);
    }
})();

// Define routes

// Health check
app.get('/api/health', (req, res) => {
    res.status(200).send({ status: 'UP', service: 'Bank API' });
});

// Get user data using DID with selective disclosure
app.get('/api/user/:did', async (req, res) => {
    try {
        const { did } = req.params;
        
        // Validate DID format
        if (!did.startsWith('did:')) {
            return res.status(400).send({ error: 'Invalid DID format. Must start with "did:"' });
        }
        
        // Verify authorization header (JWT or similar)
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).send({ error: 'Authorization required' });
        }
        
        // Check if bank is authorized to access the DID's data
        const authId = `${did}-${BANK_ORG_ID}`;
        let authorization;
        
        try {
            authorization = await authorizationDB.get(authId);
        } catch (error) {
            if (error.name === 'not_found') {
                return res.status(403).send({
                    error: 'Not authorized',
                    message: 'Bank is not authorized to access data for this DID',
                    requestInstructions: {
                        endpoint: '/api/user/request-access',
                        method: 'POST',
                        body: { did }
                    }
                });
            }
            throw error;
        }
        
        // Check if authorization is expired
        const now = new Date();
        const expiresAt = new Date(authorization.expiresAt);
        
        if (now > expiresAt) {
            return res.status(403).send({
                error: 'Authorization expired',
                message: 'The authorization to access this data has expired',
                requestInstructions: {
                    endpoint: '/api/user/request-access',
                    method: 'POST',
                    body: { did }
                }
            });
        }
        
        // Verify the presentation (in a real system, this would involve cryptographic verification)
        if (!authorization.presentation) {
            return res.status(500).send({
                error: 'Invalid authorization',
                message: 'Authorization record is missing the verifiable presentation'
            });
        }
        
        // Log access to bank database
        const accessLog = {
            _id: `access_${did}_${Date.now()}`,
            did,
            accessedAt: new Date().toISOString(),
            attributes: authorization.attributes,
            // Add a unique request ID for audit purposes
            requestId: crypto.randomBytes(16).toString('hex')
        };
        
        await bankDB.put(accessLog);
        
        // Return the presentation which contains only the authorized attributes
        res.status(200).send({
            // Include only the selected fields from the VP that are relevant to the client
            holder: authorization.presentation.holder,
            attributes: extractAttributesFromPresentation(authorization.presentation),
            issuer: authorization.presentation.verifiableCredential[0].issuer,
            issuanceDate: authorization.presentation.verifiableCredential[0].issuanceDate,
            expirationDate: authorization.presentation.verifiableCredential[0].expirationDate,
            requestId: accessLog.requestId
        });
    } catch (error) {
        console.error(`Failed to get user data: ${error}`);
        res.status(500).send({ error: error.message });
    }
});

// Helper function to extract attributes from a verifiable presentation
function extractAttributesFromPresentation(presentation) {
    const attributes = {};
    
    if (presentation && 
        presentation.verifiableCredential && 
        presentation.verifiableCredential.length > 0 &&
        presentation.verifiableCredential[0].credentialSubject) {
        
        const subject = presentation.verifiableCredential[0].credentialSubject;
        
        // Copy all attributes except 'id'
        Object.keys(subject).forEach(key => {
            if (key !== 'id') {
                attributes[key] = subject[key];
            }
        });
    }
    
    return attributes;
}

// Request access to user data
app.post('/api/user/request-access', async (req, res) => {
    try {
        const { did } = req.body;
        
        if (!did) {
            return res.status(400).send({ error: 'Missing required fields' });
        }
        
        // Validate DID format
        if (!did.startsWith('did:')) {
            return res.status(400).send({ error: 'Invalid DID format. Must start with "did:"' });
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
        
        // Create access request record
        const accessRequest = {
            _id: `request_${did}_${Date.now()}`,
            did,
            orgId: BANK_ORG_ID,
            status: 'pending',
            requestedAt: new Date().toISOString(),
            requestedAttributes: ['name', 'age'], // Bank only needs name and age
            callbackUrl: `https://bank.example/callback/${did}`
        };
        
        await bankDB.put(accessRequest);
        
        // In a real implementation, this would trigger a notification to the user
        // or redirect to a consent management interface
        res.status(200).send({
            message: `Access request for DID ${did} has been created`,
            requestId: accessRequest._id,
            instructions: 'The user needs to authorize access by calling the Government API with the following details:',
            endpoint: 'POST /api/did/authorize',
            body: {
                did: did,
                orgId: BANK_ORG_ID,
                attributes: ['name', 'age']
            }
        });
    } catch (error) {
        console.error(`Failed to request access: ${error}`);
        res.status(500).send({ error: error.message });
    }
});

// Verify the validity of a verifiable presentation
app.post('/api/verify/presentation', async (req, res) => {
    try {
        const { presentation } = req.body;
        
        if (!presentation) {
            return res.status(400).send({ error: 'Missing verifiable presentation' });
        }
        
        // In a real implementation, this would perform cryptographic verification
        // Here we just do basic checks
        const isValid = 
            presentation['@context'] && 
            presentation.type === 'VerifiablePresentation' &&
            presentation.holder && 
            presentation.verifiableCredential &&
            presentation.proof;
        
        if (!isValid) {
            return res.status(400).send({ 
                error: 'Invalid presentation format',
                valid: false
            });
        }
        
        // Verify proof (simplified)
        const proofIsValid = true; // In a real system, this would perform cryptographic validation
        
        res.status(200).send({
            valid: proofIsValid,
            holder: presentation.holder,
            credentials: presentation.verifiableCredential.length,
            verified: new Date().toISOString()
        });
    } catch (error) {
        console.error(`Failed to verify presentation: ${error}`);
        res.status(500).send({ error: error.message });
    }
});

// Start the server
app.listen(PORT, HOST, () => {
    console.log(`Bank API running on http://${HOST}:${PORT}`);
});