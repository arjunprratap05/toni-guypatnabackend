// services/whatsapp.js
const axios = require('axios');

/**
 * Utility: normalize any phone number to WhatsApp's expected format
 * - Strips everything except digits
 * - Adds India country code (91) if a 10-digit local number was given
 */
function formatPhoneNumber(rawPhone) {
    if (!rawPhone) return null;
    let formatted = String(rawPhone).replace(/\D/g, '');
    if (formatted.length === 10) {
        formatted = `91${formatted}`;
    }
    return formatted;
}

/**
 * Utility: extract the cleanest possible error message from a failed
 * Meta Graph API call, so logs are always readable.
 */
function extractMetaError(err) {
    return (
        err.response?.data?.error?.error_data?.details ||
        err.response?.data?.error?.message ||
        err.message ||
        'Unknown WhatsApp API error'
    );
}

/**
 * Core sender: posts a template message to Meta's Cloud API.
 * Shared by both customer and staff notifications.
 */
async function sendTemplateMessage(toPhone, bodyParams, { logLabel, templateName = 'booking_confirmation_us', includeButton = false }) {
    const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;

    const components = [
        {
            type: 'body',
            parameters: bodyParams
        }
    ];

    // Only attach a button component if this specific template actually
    // has a dynamic-URL button that needs a parameter. The default
    // booking_confirmation_us template's Website button is static, so no
    // button component is sent for it.
    if (includeButton) {
        components.push({
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: 'services' }]
        });
    }

    const payload = {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: {
            name: templateName,
            language: { code: 'en_US' },
            components
        }
    };

    try {
        console.log(`[WhatsApp Service] Sending ${logLabel} to ${toPhone}...`);
        const response = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[WhatsApp Service] ${logLabel} dispatched successfully to ${toPhone}`);
        return { success: true, data: response.data };
    } catch (err) {
        const metaMessage = extractMetaError(err);
        console.error(`[WhatsApp Service] ${logLabel} FAILED for ${toPhone}: ${metaMessage}`);
        // Return a structured failure instead of throwing, so callers can
        // decide what to do (e.g. fall back to email) without try/catch
        // boilerplate everywhere.
        return { success: false, error: metaMessage };
    }
}

/**
 * Send booking confirmation to the CUSTOMER.
 * Returns { success, data } or { success: false, error }.
 */
exports.sendBookingConfirmation = async (clientPhone, clientName, date, timeSlot) => {
    const formattedPhone = formatPhoneNumber(clientPhone);

    if (!formattedPhone) {
        console.error('[WhatsApp Service] No client phone number provided — skipping customer notification.');
        return { success: false, error: 'Missing client phone number' };
    }

    const bodyParams = [
        { type: 'text', text: clientName || 'Valued Client' },
        { type: 'text', text: date },
        { type: 'text', text: timeSlot }
    ];

    return sendTemplateMessage(formattedPhone, bodyParams, { logLabel: 'customer confirmation' });
};

/**
 * Send booking alert to SALON STAFF.
 * Returns { success, data } or { success: false, error }.
 */
exports.notifySalonStaff = async (clientName, date, timeSlot) => {
    const rawStaffPhone = process.env.SALON_STAFF_PHONE;

    if (!rawStaffPhone) {
        console.warn('[WhatsApp Service] SALON_STAFF_PHONE not set — skipping staff notification.');
        return { success: false, error: 'Missing SALON_STAFF_PHONE env var' };
    }

    const formattedPhone = formatPhoneNumber(rawStaffPhone);

    const bodyParams = [
        { type: 'text', text: clientName || 'Client' },
        { type: 'text', text: date },
        { type: 'text', text: timeSlot }
    ];

    // Uses a dedicated staff template ("New booking: {{1}} on {{2}} at {{3}}")
    // so staff messages read cleanly instead of reusing the customer-facing
    // "[STAFF ALERT]" prefix hack. This template must be created and approved
    // in WhatsApp Manager first — see STAFF_TEMPLATE_NAME below.
    const STAFF_TEMPLATE_NAME = process.env.WHATSAPP_STAFF_TEMPLATE_NAME || 'staff_booking_alert';

    const result = await sendTemplateMessage(formattedPhone, bodyParams, {
        logLabel: 'staff alert',
        templateName: STAFF_TEMPLATE_NAME
    });

    if (!result.success && result.error?.toLowerCase().includes('template')) {
        // Staff template likely doesn't exist / isn't approved yet —
        // fall back to the known-good customer template so staff still
        // get *a* notification while the new template clears review.
        console.warn(`[WhatsApp Service] "${STAFF_TEMPLATE_NAME}" unavailable, falling back to booking_confirmation_us for staff alert.`);
        const fallbackParams = [
            { type: 'text', text: `[STAFF ALERT] ${clientName || 'Client'}` },
            { type: 'text', text: date },
            { type: 'text', text: timeSlot }
        ];
        return sendTemplateMessage(formattedPhone, fallbackParams, {
            logLabel: 'staff alert (fallback template)',
            templateName: 'booking_confirmation_us'
        });
    }

    return result;
};

/**
 * Bulk template sender (e.g. marketing/reminder blasts).
 * Batches requests to avoid hitting Meta's rate limits.
 */
exports.sendBulkMessages = async (customers, templateName) => {
    const BATCH_SIZE = 20;
    const DELAY_MS = 1000;

    let successCount = 0;
    let failCount = 0;
    const failedNumbers = [];

    console.log(`[WhatsApp Service] Starting bulk send to ${customers.length} customers using template "${templateName}"...`);

    for (let i = 0; i < customers.length; i += BATCH_SIZE) {
        const batch = customers.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(async (customer) => {
            const formattedPhone = formatPhoneNumber(customer.phone);
            const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
            const payload = {
                messaging_product: 'whatsapp',
                to: formattedPhone,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: 'en_US' }
                }
            };

            return axios.post(url, payload, {
                headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
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
                    error: extractMetaError(result.reason)
                });
            }
        });

        if (i + BATCH_SIZE < customers.length) {
            await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        }
    }

    console.log(`[WhatsApp Service] Bulk send complete. Success: ${successCount}, Failed: ${failCount}`);
    return { successCount, failCount, failedNumbers };
};