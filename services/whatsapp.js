// services/whatsapp.js
const axios = require('axios');

/**
 * Business Logic to trigger Meta's Cloud API
 */
exports.sendBookingConfirmation = async (clientPhone, clientName, date, timeSlot) => {
    // 1. Format the phone number
    let formattedPhone = clientPhone.replace(/\D/g, ''); 
    if (formattedPhone.length === 10) {
        formattedPhone = `91${formattedPhone}`; 
    }

    const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;

    // 2. Build the Meta payload for the Custom Template
    const payload = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "template",
        template: {
            name: "booking_confirmation", // Ensure this matches your Meta template name exactly
            language: {
                code: "en_US" // Change to "hi" if your template was approved in Hindi
            },
            components: [
                {
                    type: "body",
                    parameters: [
                        {
                            type: "text",
                            text: clientName || "Valued Client" // Maps to {{1}}
                        },
                        {
                            type: "text",
                            text: date // Maps to {{2}}
                        },
                        {
                            type: "text",
                            text: timeSlot // Maps to {{3}}
                        }
                    ]
                }
            ]
        }
    };

    // 3. Fire the request
    const response = await axios.post(url, payload, {
        headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });

    console.log(`[WhatsApp Service] Confirmation successfully dispatched to ${formattedPhone}`);
    return response.data;
};

exports.sendBulkMessages = async (customers, templateName) => {
    const BATCH_SIZE = 20; // Send 20 messages at a time
    const DELAY_MS = 1000; // Wait 1 second between batches to respect Meta's rate limits

    let successCount = 0;
    let failCount = 0;
    const failedNumbers = [];

    console.log(`Starting bulk send to ${customers.length} customers...`);

    // Loop through customers in chunks of 20
    for (let i = 0; i < customers.length; i += BATCH_SIZE) {
        const batch = customers.slice(i, i + BATCH_SIZE);

        // Map over the batch and create an array of API request promises
        const batchPromises = batch.map(async (customer) => {
            let formattedPhone = customer.phone.replace(/\D/g, ''); 
            if (formattedPhone.length === 10) formattedPhone = `91${formattedPhone}`;

            const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
            const payload = {
                messaging_product: "whatsapp",
                to: formattedPhone,
                type: "template",
                template: {
                    name: templateName, 
                    language: { code: "en_US" },
                    // If your marketing template has variables (like their name), add components here
                }
            };

            return axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
        });

        // Execute the batch of 20 concurrently and wait for them all to finish
        // We use allSettled instead of all() so one failure doesn't crash the whole batch
        const results = await Promise.allSettled(batchPromises);

        // Tally up the successes and failures
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successCount++;
            } else {
                failCount++;
                failedNumbers.push({ 
                    phone: batch[index].phone, 
                    error: result.reason.response?.data?.error?.message || "Unknown Error" 
                });
            }
        });

        // Wait 1 second before sending the next batch to keep Meta happy
        if (i + BATCH_SIZE < customers.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    console.log(`Bulk send complete. Success: ${successCount}, Failed: ${failCount}`);
    return { successCount, failCount, failedNumbers };
};