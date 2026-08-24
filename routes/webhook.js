// Webhook Verification (GET request from Meta)
app.get('/api/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Verify token matches your chosen secret
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'ToniAndGuyPatna2026';

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('[Meta Webhook] Verified successfully!');
            return res.status(200).send(challenge);
        } else {
            return res.sendStatus(403);
        }
    }
    return res.sendStatus(400);
});

// Incoming Message & Delivery Events (POST request from Meta)
app.post('/api/webhook', (req, res) => {
    const body = req.body;

    if (body.object) {
        console.log('[Meta Event Received]:', JSON.stringify(body, null, 2));
        return res.status(200).send('EVENT_RECEIVED');
    }

    return res.sendStatus(404);
});