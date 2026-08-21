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
        template: {
            name: "booking_confirmation_us",
            language: {
                code: "en_US" 
            },
            components: [
                {
                    type: "header",
                    parameters: [
                        {
                            type: "text",
                            text: "Booking Confirmed!"
                        }
                    ]
                },
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: clientName || "Valued Client" }, // {{1}}
                        { type: "text", text: date },       // {{2}}
                        { type: "text", text: timeSlot }    // {{3}}
                    ]
                },
                {
                    type: "button",
                    sub_type: "url",
                    index: "0",
                    parameters: [
                        {
                            type: "text",
                            text: ""
                        }
                    ]
                }
            ]
        }
    };

    // 3. Fire the request
    const response = await axios.post(url, payload, {
        headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
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
                    language: { code: "en_US" }
                }
            };

            return axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
        });

        // Execute the batch concurrently and wait for them to finish
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

        // Wait 1 second before sending the next batch
        if (i + BATCH_SIZE < customers.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    console.log(`Bulk send complete. Success: ${successCount}, Failed: ${failCount}`);
    return { successCount, failCount, failedNumbers };
};

/**
 * Send booking alert to Salon Staff
 */
exports.notifySalonStaff = async (clientName, date, timeSlot) => {
    const staffPhone = process.env.SALON_STAFF_PHONE;
    
    const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;

    const payload = {
        messaging_product: "whatsapp",
        to: staffPhone,
        type: "template",
        template: {
            name: "booking_confirmation_us",
            language: { code: "en_US" },
            components: [
                {
                    type: "header",
                    parameters: [{ type: "text", text: "New Booking Alert!" }] // Header for staff
                },
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: clientName },
                        { type: "text", text: date },
                        { type: "text", text: timeSlot }
                    ]
                }
            ]
        }
    };

    return axios.post(url, payload, {
        headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
};