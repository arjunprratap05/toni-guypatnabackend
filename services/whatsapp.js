// services/whatsapp.js
const axios = require('axios');

/**
 * Business Logic to trigger Meta's Cloud API
 */
exports.sendBookingConfirmation = async (clientPhone, clientName, date, timeSlot) => {
    let formattedPhone = clientPhone.replace(/\D/g, ''); 
    if (formattedPhone.length === 10) {
        formattedPhone = `91${formattedPhone}`; 
    }

    const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;

    const payload = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "template",
        template: {
            name: "booking_confirmation_us",
            language: {
                code: "en_US" 
            },
            components: [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: clientName || "Valued Client" },
                        { type: "text", text: date },
                        { type: "text", text: timeSlot }
                    ]
                }
                // Removed the button component — only include it if your
                // Website button URL actually has a {{1}} dynamic suffix.
                // If it does, add it back with a real non-empty text value.
            ]
        }
    };

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
    const BATCH_SIZE = 20; 
    const DELAY_MS = 1000; 

    let successCount = 0;
    let failCount = 0;
    const failedNumbers = [];

    console.log(`Starting bulk send to ${customers.length} customers...`);

    for (let i = 0; i < customers.length; i += BATCH_SIZE) {
        const batch = customers.slice(i, i + BATCH_SIZE);

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

        const results = await Promise.allSettled(batchPromises);

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
    const rawStaffPhone = process.env.SALON_STAFF_PHONE;
    
    if (!rawStaffPhone) return;

    // Format consistently with the other functions
    let staffPhone = rawStaffPhone.replace(/\D/g, '');
    if (staffPhone.length === 10) staffPhone = `91${staffPhone}`;

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
                    type: "body",
                    parameters: [
                        { type: "text", text: `[STAFF ALERT] ${clientName}` },
                        { type: "text", text: date },
                        { type: "text", text: timeSlot }
                    ]
                },
                {
                    type: "button",
                    sub_type: "url",
                    index: "0",
                    parameters: [
                        { type: "text", text: "services" }
                    ]
                }
            ]
        }
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[WhatsApp Service] Staff alert dispatched to ${staffPhone}`);
        return response.data;
    } catch (err) {
        const metaMessage = err.response?.data?.error?.error_data?.details 
            || err.response?.data?.error?.message 
            || err.message;
        console.error(`[WhatsApp Service] Staff alert FAILED: ${metaMessage}`);
        throw new Error(`WhatsApp staff notification failed: ${metaMessage}`);
    }
};