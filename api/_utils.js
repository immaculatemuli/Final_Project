import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { OpenAI } from 'openai';
import axios from 'axios';
import crypto from 'crypto';

// Initialize Firebase Admin once
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else if (process.env.FIREBASE_CONFIG) {
      // In some environments, Firebase provides a JSON config string
      admin.initializeApp(JSON.parse(process.env.FIREBASE_CONFIG));
    } else {
      // Last resort fallback
      admin.initializeApp();
    }
  } catch (error) {
    console.error('Firebase Admin init error (continuing without DB):', error);
  }
}

export { admin, nodemailer, OpenAI, axios, crypto };

/**
 * CORS Wrapper for Vercel Serverless Functions
 */
export const withCors = (handler) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  return handler(req, res);
};

let cachedTransporter = null;
export async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASS) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    return cachedTransporter;
  }

  // Fallback to Ethereal if no env vars
  const test = await nodemailer.createTestAccount();
  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: test.user, pass: test.pass },
  });
  return cachedTransporter;
}

export function extractJSON(responseText) {
  try {
    return JSON.parse(responseText);
  } catch (e) {
    let cleaned = responseText.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    cleaned = cleaned.trim();
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonStr);
      }
      throw new Error('Unable to extract valid JSON from response');
    }
  }
}
