require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); 
const connectDB = require('./config/db');
const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

// Initialize the Express App
const app = express();

// ==========================================
// 1. GLOBAL MIDDLEWARE & SECURITY
// ==========================================

// Helmet protects your app from well-known web vulnerabilities by setting HTTP headers appropriately.
app.use(helmet()); 

// CORS configuration - Only allow requests from your specific Vercel frontend domain
const allowedOrigins = [
    'https://toniandguypatna.com',
    'https://www.toniandguypatna.com',
    'http://localhost:5173'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like Postman or mobile/curl requests)
        if (!origin) return callback(null, true);
        
        // Clean the incoming origin string just in case
        const cleanOrigin = origin.trim().replace(/\/$/, '');
        
        if (allowedOrigins.includes(cleanOrigin)) {
            callback(null, true);
        } else {
            console.error(`[CORS Blocked] Origin: "${origin}"`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
}));

// Body parser with a strict payload limit to prevent DOS attacks
app.use(express.json({ limit: '10kb' })); 

// ==========================================
// 2. DATABASE INITIALIZATION
// ==========================================
// Vercel spins this up on demand. connectDB handles caching the connection.
connectDB(); 

// ==========================================
// 3. ROUTE MOUNTING
// ==========================================
// Core appointment routes
app.use('/api/appointments', require('./routes/appointments'));

/* 
  UNCOMMENT THESE LATER: 
  Temporarily commented out so Node doesn't crash before you create the files.
*/
// app.use('/api/stylists', require('./routes/stylists'));
// app.use('/api/services', require('./routes/services'));
// app.use('/api/users', require('./routes/auth'));

// ==========================================
// 4. HEALTH CHECK
// ==========================================
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'TONI&GUY Patna API is fully operational.',
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// 5. GLOBAL ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
    console.error(`[Error]: ${err.message}`);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    });
});

// ==========================================
// 6. SERVERLESS EXPORT
// ==========================================
const PORT = process.env.PORT || 5000;

// If we are running this file directly locally, start the server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is actively running on port ${PORT}`);
    });
}

app.get('/', (req, res) => {
    res.send("Backend API is running successfully on Vercel!");
});

module.exports = app;