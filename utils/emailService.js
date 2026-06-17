const nodemailer = require('nodemailer');

const sendBookingNotification = async (appointment) => {
    try {
        if (!process.env.emailid) {
            console.error("EMAIL ABORTED: process.env.emailid is undefined. Check your .env file.");
            return; 
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD 
            }
        });

        // 1. Format the services array into a readable HTML list
        const servicesList = appointment.services && appointment.services.length > 0
            ? appointment.services.map(s => `<li>${s.name} - ₹${s.price}</li>`).join('')
            : '<li>No specific services listed</li>';

        // 2. Determine if a specific artist was requested
        const requestedArtist = appointment.stylistId ? `Artist ID: ${appointment.stylistId}` : 'Any Available Artist';

        // 3. Build the comprehensive email body
        const mailOptions = {
            from: process.env.SMTP_EMAIL,
            to: process.env.emailid,
            subject: `New Salon Booking: ${appointment.date} at ${appointment.timeSlot}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eaeaea;">
                    <h2 style="color: #d4af37;">New Appointment Alert</h2>
                    <hr style="border: none; border-top: 1px solid #eaeaea; margin-bottom: 20px;" />
                    
                    <h3 style="margin-bottom: 10px;">Client Details</h3>
                    <p style="margin: 5px 0;"><strong>Client Name:</strong> ${appointment.clientName || 'Not Provided'}</p>
                    <p style="margin: 5px 0;"><strong>Client Contact (Phone):</strong> ${appointment.userId || 'Not Provided'}</p>
                    
                    <h3 style="margin-top: 20px; margin-bottom: 10px;">Schedule Details</h3>
                    <p style="margin: 5px 0;"><strong>Date:</strong> ${appointment.date}</p>
                    <p style="margin: 5px 0;"><strong>Time:</strong> ${appointment.timeSlot}</p>
                    <p style="margin: 5px 0;"><strong>Requested Artist:</strong> ${requestedArtist}</p>
                    
                    <h3 style="margin-top: 20px; margin-bottom: 10px;">Requested Services</h3>
                    <ul style="margin-top: 0;">
                        ${servicesList}
                    </ul>
                    
                    <h3 style="margin-top: 20px; color: #333;">Total Amount: ₹${appointment.totalAmount}</h3>
                    
                    <hr style="border: none; border-top: 1px solid #eaeaea; margin-top: 30px; margin-bottom: 20px;" />
                    <p style="color: #666; font-size: 12px;">Please ensure the station is prepared for this client.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('Comprehensive notification email sent successfully to salon staff.');
    } catch (error) {
        console.error('Failed to send notification email:', error);
    }
};

module.exports = { sendBookingNotification };