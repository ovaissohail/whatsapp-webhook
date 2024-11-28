const express = require('express');
const axios = require('axios'); // Add this at the top after installing
const app = express();
const PORT = process.env.PORT || 10000;

//load env variables
require('dotenv').config();

// Parse JSON bodies
app.use(express.json());

// Add logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// WhatsApp sending function
async function sendWhatsAppMessage(to, message) {
    try {
        const response = await axios.post(
            `https://graph.facebook.com/${process.env.VERSION}/${process.env.PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to: to,
                text: { body: message }
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Message sent successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error sending WhatsApp message:', error.response?.data || error.message);
        throw error;
    }
}

app.get('/', (req, res) => {
    console.log('Root route hit');
    res.send('Server is up and running!');
});

app.get('/webhook', (req, res) => {
    console.log('Webhook route hit');
    const VERIFY_TOKEN = "12345";
    
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

app.post('/webhook', async (req, res) => {
    try {
        console.log('Received webhook data:', JSON.stringify(req.body, null, 2));
        
        let phoneNumber;
        let messageText;

        // Handle test messages
        if (req.body.field === 'messages') {
            const testMessage = req.body.value.messages[0];
            phoneNumber = testMessage.from;
            messageText = testMessage.text.body;
            console.log('Test message received:', messageText);
        }
        // Handle real messages
        else if (req.body.entry) {
            const message = req.body.entry[0].changes[0].value.messages[0];
            phoneNumber = message.from;
            messageText = message.text.body;
            console.log('Real message received:', messageText);
        }

        // If we successfully got a message, send a response
        if (phoneNumber && messageText) {
            try {
                // Send a simple echo response for testing
                await sendWhatsAppMessage(phoneNumber, `Echo: ${messageText}`);
                console.log('Response sent successfully');
            } catch (error) {
                console.error('Error sending response:', error);
            }
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