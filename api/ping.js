import { withCors } from './_utils.js';

const handler = async (req, res) => {
  return res.status(200).json({
    active: true,
    env_keys: {
      has_openai: !!process.env.OPENAI_API_KEY,
      has_groq: !!process.env.GROQ_API_KEY,
      has_email: !!process.env.EMAIL_USER,
      has_email_pass: !!process.env.EMAIL_APP_PASS,
      has_service_account: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    }
  });
};

export default withCors(handler);
