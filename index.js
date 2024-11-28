const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

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

// Handle incoming webhook messages
app.post('/webhook', (req, res) => {
    console.log('Received webhook:', JSON.stringify(req.body, null, 2));
    
    // Send a 200 OK response
    res.status(200).send('OK');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});