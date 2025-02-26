const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// Load env variables
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

// Updated forwardToPython function to handle streaming responses
async function forwardToPython(messageData) {
    try {
        const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL;
        console.log(`Sending request to Python service: ${PYTHON_SERVICE_URL}/process`);
        
        // Use responseType: 'stream' to handle streaming responses
        const response = await axios.post(`${PYTHON_SERVICE_URL}/process`, messageData, {
            responseType: 'stream'
        });
        
        return response.data;
    } catch (error) {
        console.error('Error forwarding to Python:', error.response?.data || error.message);
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
        
        // Check for status updates which have a different structure
        if (req.body?.entry?.[0]?.changes?.[0]?.value?.statuses) {
            console.log('Received status update, ignoring');
            return res.status(200).send('OK');
        }
        
        // First, validate that we have the required data
        if (req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const message = req.body.entry[0].changes[0].value.messages[0];
            const phoneNumber = message.from;
            
            // Create base message data with required fields
            // Create base message data with required fields
            let messageData = {
                phone_number: phoneNumber,
                messageType: message.type,
                message: '' // Initialize empty message
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
                    messageData.message = message.image.caption || '';
                    break;
                case 'location':
                    messageData.message = `${message.location.latitude}, ${message.location.longitude}`;
                    messageData.location = {
                        latitude: message.location.latitude,
                        longitude: message.location.longitude
                    };
                    break;
                default:
                    console.log(`Unhandled message type: ${message.type}`);
                default:
                    console.log(`Unhandled message type: ${message.type}`);
            }

            console.log('Message received:', messageData);

            try {
                // Forward to Python service and get stream
                const pythonStream = await forwardToPython(messageData);
                
                // Set up a buffer to collect chunks
                let buffer = '';
                
                // Process each chunk in the stream
                pythonStream.on('data', async (chunk) => {
                    try {
                        const chunkStr = chunk.toString();
                        console.log('Received chunk:', chunkStr);
                        
                        // Add to buffer
                        buffer += chunkStr;
                        
                        // Process complete JSON objects
                        let newlineIndex;
                        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                            const line = buffer.substring(0, newlineIndex);
                            buffer = buffer.substring(newlineIndex + 1);
                            
                            if (line.trim()) {
                                try {
                                    const responseData = JSON.parse(line);
                                    if (responseData?.reply) {
                                        console.log('Sending intermediate response:', responseData.reply);
                                        await sendWhatsAppMessage(phoneNumber, responseData.reply);
                                    }
                                } catch (jsonError) {
                                    console.error('Error parsing JSON from chunk:', jsonError, line);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error processing stream chunk:', error);
                    }
                });
                
                pythonStream.on('end', () => {
                    console.log('Stream processing completed');
                });
                
                pythonStream.on('error', (error) => {
                    console.error('Stream error:', error);
                });
                
            } catch (error) {
                console.error('Error in processing or responding:', error);
                await sendWhatsAppMessage(phoneNumber, "Sorry, there was an error processing your message.");
            }
        } else {
            console.log('Received webhook event with different structure:', req.body);
        }

        // Always return 200 OK for webhook
        res.status(200).send('OK');
    } catch (error) {
        console.error('Critical error processing webhook:', error);
        // Always return 200 for webhook
        res.status(200).send('OK');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment variables loaded: PYTHON_SERVICE_URL=${process.env.PYTHON_SERVICE_URL || 'NOT SET'}`);
});
