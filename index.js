const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

// Parse JSON bodies
app.use(express.json());

// Add logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => {
    console.log('Root route hit');
    res.send('Server is up and running!');
});

app.get('/webhook', (req, res) => {
    console.log('Webhook route hit');
    const VERIFY_TOKEN = "mywebhook123";
    
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];
    
    console.log('Webhook params:', { mode, token, challenge });
    
    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        } else {
            console.log("WEBHOOK_VERIFICATION_FAILED");
            res.sendStatus(403);
        }
    } else {
        console.log("Missing mode or token");
        res.sendStatus(400);
    }
});

// WhatsApp webhook verification
app.get('/webhook', (req, res) => {
    // Your verify token (you'll set this in the Meta dashboard)
    const VERIFY_TOKEN = "12345";
    
    // Parse parameters from the webhook verification request
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];
    
    // Check if a token and mode were sent
    if (mode && token) {
        // Check the mode and token sent are correct
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            // Respond with 200 OK and challenge token
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});

app.post('/webhook', async (req, res) => {
    try {
        console.log('Received webhook data:', JSON.stringify(req.body, null, 2));
        
        // Handle test messages (which come directly in the format you showed)
        if (req.body.field === 'messages') {
            const testMessage = req.body.value.messages[0];
            console.log('Test message received:', testMessage.text.body);
        }
        // Handle real messages (which come in the entry array format)
        else if (req.body.entry) {
            const message = req.body.entry[0].changes[0].value.messages[0];
            console.log('Real message received:', message);
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(200).send('OK');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});