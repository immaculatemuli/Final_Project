import { withCors, getTransporter } from './_utils.js';

const handler = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { to, toName, subject, html, text } = req.body || {};
  
  if (!to || !html) {
    return res.status(400).json({ error: 'Missing required fields: to and html' });
  }

  try {
    const transporter = await getTransporter();
    
    // Check if transporter is actually configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASS) {
      return res.status(501).json({ 
        error: 'Email service not configured on server. Please set EMAIL_USER and EMAIL_APP_PASS in Vercel settings.' 
      });
    }

    const mailOptions = {
      from: `"Intellicode AI" <${process.env.EMAIL_USER}>`,
      to,
      subject: subject || 'Code Analysis Report',
      text: text || 'Your code analysis report is ready. Please view the HTML version for full details.',
      html: html,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ success: true, message: `Report sent successfully to ${to}` });
  } catch (error) {
    console.error('Email sending error:', error);
    return res.status(500).json({ 
      error: 'Failed to send email report', 
      details: error.message 
    });
  }
};

export default withCors(handler);
