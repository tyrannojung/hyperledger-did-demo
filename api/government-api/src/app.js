'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const PouchDB = require('pouchdb');

// Constants
const PORT = 3001;
const HOST = '0.0.0.0';

// Initialize express app
const app = express();

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Setup database connection
const didDB = new PouchDB('http://admin:adminpw@localhost:5984/did_db');
const authDB = new PouchDB('http://admin:adminpw@localhost:5984/auth_db');

// Initialize databases
(async () => {
    try {
        await didDB.info();
        await authDB.info();
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
        const { userId, name, age, gender, occupation } = req.body;
        
        if (!userId || !name || !age || !gender || !occupation) {
            return res.status(400).send({ error: 'Missing required fields' });
        }
        
        // Check if DID already exists
        try {
            await didDB.get(userId);
            return res.status(409).send({ error: `DID with ID ${userId} already exists` });
        } catch (err) {
            if (err.name !== 'not_found') {
                throw err;
            }
            // DID doesn't exist, continue with registration
        }
        
        // Create DID document
        const timestamp = new Date().toISOString();
        const didDoc = {
            _id: userId,
            name,
            age: parseInt(age),
            gender,
            occupation,
            creator: 'government_admin',
            createdAt: timestamp,
            updatedAt: timestamp,
            type: 'did-document',
            authorizations: []
        };
        
        // Store DID in database
        await didDB.put(didDoc);
        
        res.status(201).send(didDoc);
    } catch (error) {
        console.error(`Failed to register DID: ${error}`);
        res.status(500).send({ error: error.message });
    }
});

// Get a DID by userId
app.get('/api/did/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Retrieve DID from database
        const didDoc = await didDB.get(userId);
        
        res.status(200).send(didDoc);
    } catch (error) {
        if (error.name === 'not_found') {
            return res.status(404).send({ error: `DID with ID ${req.params.userId} not found` });
        }
        console.error(`Failed to get DID: ${error}`);
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
        
        const dids = result.rows.map(row => row.doc);
        
        res.status(200).send(dids);
    } catch (error) {
        console.error(`Failed to list DIDs: ${error}`);
        res.status(500).send({ error: error.message });
    }
});

// Authorize an organization to access user data
app.post('/api/did/authorize', async (req, res) => {
    try {
        const { userId, orgId, attributes } = req.body;
        
        if (!userId || !orgId || !attributes) {
            return res.status(400).send({ error: 'Missing required fields' });
        }
        
        // Check if DID exists
        try {
            await didDB.get(userId);
        } catch (error) {
            if (error.name === 'not_found') {
                return res.status(404).send({ error: `DID with ID ${userId} not found` });
            }
            throw error;
        }
        
        // Validate attributes - can only be name, age, gender, occupation
        const validAttrs = ['name', 'age', 'gender', 'occupation'];
        for (const attr of attributes) {
            if (!validAttrs.includes(attr)) {
                return res.status(400).send({ error: `Invalid attribute: ${attr}` });
            }
        }
        
        // Create authorization
        const timestamp = new Date().toISOString();
        const authDoc = {
            _id: `${userId}-${orgId}`,
            userId,
            orgId,
            attributes,
            issuer: 'government_admin',
            issuedAt: timestamp,
            expiresAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours
            type: 'did-authorization'
        };
        
        // Store authorization in database
        await authDB.put(authDoc);
        
        res.status(200).send({
            message: `Access granted to ${orgId} for user ${userId}`,
            details: authDoc
        });
    } catch (error) {
        console.error(`Failed to authorize access: ${error}`);
        res.status(500).send({ error: error.message });
    }
});

// Revoke organization access to user data
app.post('/api/did/revoke', async (req, res) => {
    try {
        const { userId, orgId } = req.body;
        
        if (!userId || !orgId) {
            return res.status(400).send({ error: 'Missing required fields' });
        }
        
        // Check if authorization exists
        const authId = `${userId}-${orgId}`;
        try {
            const authDoc = await authDB.get(authId);
            await authDB.remove(authDoc);
        } catch (error) {
            if (error.name === 'not_found') {
                return res.status(404).send({ error: `No authorization found for ${orgId} on DID ${userId}` });
            }
            throw error;
        }
        
        res.status(200).send({
            message: `Access revoked from ${orgId} for user ${userId}`
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