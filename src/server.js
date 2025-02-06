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

// Update the forwardToPython function to use environment variable for URL
async function forwardToPython(messageData) {
    try {
        const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL;
        const response = await axios.post(`${PYTHON_SERVICE_URL}/process`, messageData);
        return response.data;
    } catch (error) {
        console.error('Error forwarding to Python:', error.message);
        throw error;
    }
}

app.get('/', (req, res) => {
    console.log('Root route hit');
    res.send('Server is up and running!');
});

app.get('/webhook', (req, res) => {
    console.log('Webhook route hit');
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
    
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
        
        // First, validate that we have the required data
        if (req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const message = req.body.entry[0].changes[0].value.messages[0];
            const phoneNumber = message.from;
            
            // Create base message data with required fields
            let messageData = {
                phone_number: phoneNumber,
                messageType: message.type,
                message: '' // Initialize empty message
            };

            // Handle different message types
            switch (message.type) {
                case 'text':
                    messageData.message = message.text.body;
                    break;
                case 'audio':
                    messageData.audioData = message.audio;
                    break;
                case 'image':
                    messageData.imageData = message.image;
                    messageData.message = message.image.caption || '';
                    break;
                case 'location':
                    messageData.location = {
                        latitude: message.location.latitude,
                        longitude: message.location.longitude
                    };
                    break;
                default:
                    console.log(`Unhandled message type: ${message.type}`);
            }

            console.log('Message received:', messageData);

            // Forward to Python service
            const pythonResponse = await forwardToPython(messageData);

            // Send response back to WhatsApp
            if (pythonResponse?.reply) {
                await sendWhatsAppMessage(phoneNumber, pythonResponse.reply);
                console.log('Response sent successfully');
            }
        } else {
            console.log('Received webhook event with different structure:', req.body);
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Error processing webhook:', error);
        // Always return 200 for webhook
        res.status(200).send('OK');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
