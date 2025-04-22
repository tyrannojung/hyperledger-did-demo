'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const PouchDB = require('pouchdb');

// Constants
const PORT = 3002;
const HOST = '0.0.0.0';

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
const authDB = new PouchDB('http://admin:adminpw@localhost:5984/auth_db');
const didDB = new PouchDB('http://admin:adminpw@localhost:5984/did_db');

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

// Get user data with limited access (name and age only)
app.get('/api/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Verify authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).send({ error: 'Authorization required' });
        }
        
        // Check if bank is authorized to access the user's data
        const authId = `${userId}-BankMSP`;
        let authDoc;
        
        try {
            authDoc = await authDB.get(authId);
        } catch (error) {
            if (error.name === 'not_found') {
                return res.status(403).send({
                    error: 'Not authorized',
                    message: 'Bank is not authorized to access this user data'
                });
            }
            throw error;
        }
        
        // Check if authorization is expired
        const now = new Date();
        const expiresAt = new Date(authDoc.expiresAt);
        
        if (now > expiresAt) {
            return res.status(403).send({
                error: 'Authorization expired',
                message: 'The authorization to access this data has expired'
            });
        }
        
        // Retrieve user DID from government database
        const didDoc = await didDB.get(userId);
        
        // Return only authorized attributes
        const result = { _id: didDoc._id };
        for (const attr of authDoc.attributes) {
            if (didDoc[attr] !== undefined) {
                result[attr] = didDoc[attr];
            }
        }
        
        // Log access to bank database
        const accessLog = {
            _id: `access_${userId}_${Date.now()}`,
            userId,
            accessedAt: new Date().toISOString(),
            attributes: authDoc.attributes
        };
        
        await bankDB.put(accessLog);
        
        res.status(200).send(result);
    } catch (error) {
        console.error(`Failed to get user data: ${error}`);
        res.status(500).send({ error: error.message });
    }
});

// Request access to user data
app.post('/api/user/request-access', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).send({ error: 'Missing required fields' });
        }
        
        // Check if user exists
        try {
            await didDB.get(userId);
        } catch (error) {
            if (error.name === 'not_found') {
                return res.status(404).send({ error: `User with ID ${userId} not found` });
            }
            throw error;
        }
        
        // Create access request record
        const accessRequest = {
            _id: `request_${userId}_${Date.now()}`,
            userId,
            status: 'pending',
            requestedAt: new Date().toISOString(),
            requestedAttributes: ['name', 'age']
        };
        
        await bankDB.put(accessRequest);
        
        // In a real implementation, this would trigger a notification to the user
        res.status(200).send({
            message: `Access request for user ${userId} has been created`,
            instructions: 'The user needs to authorize access by calling the Government API with the following details:',
            endpoint: 'POST /api/did/authorize',
            body: {
                userId: userId,
                orgId: 'BankMSP',
                attributes: ['name', 'age']
            }
        });
    } catch (error) {
        console.error(`Failed to request access: ${error}`);
        res.status(500).send({ error: error.message });
    }
});

// Start the server
app.listen(PORT, HOST, () => {
    console.log(`Bank API running on http://${HOST}:${PORT}`);
});