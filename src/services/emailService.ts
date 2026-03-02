/**
 * Email service — sends AI code analysis reports via EmailJS (browser-based).
 *
 * SETUP (one-time):
 *  1. Sign up free at https://www.emailjs.com
 *  2. Create an Email Service (connect your Gmail)
 *  3. Create an Email Template — set Body type to "HTML" and paste:
 *       {{{html_content}}}
 *     Set the "To Email" field to: {{to_email}}
 *     Set the Subject field to:    {{subject}}
 *  4. Copy your Public Key, Service ID, and Template ID into .env.local:
 *       VITE_EMAILJS_PUBLIC_KEY=your_public_key
 *       VITE_EMAILJS_SERVICE_ID=your_service_id
 *       VITE_EMAILJS_TEMPLATE_ID=your_template_id
 */

import emailjs from '@emailjs/browser';

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  as string | undefined;

export function isEmailConfigured(): boolean {
  // In dev the Vite /mailer endpoint handles sending — always available.
  if (import.meta.env.DEV) return true;
  return !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);
}

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
export interface EmailAnalysisData {
  recipientName: string;
  recipientEmail: string;
  language: string;
  score: number;
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  recommendations: string[];
  technicalDebt: string;
  metrics: {
    complexity: number;
    maintainability: number;
    security: number;
    performance: number;
    documentation: number;
    readability: number;
  };
}

// --------------------------------------------------------------------------
// HTML email template generator
// --------------------------------------------------------------------------
export function generateHTMLEmail(data: EmailAnalysisData): string {
  const scoreColor =
    data.score >= 80 ? '#22c55e' : data.score >= 60 ? '#f59e0b' : '#ef4444';
  const scoreMsg =
    data.score >= 80
      ? 'Excellent Code Quality'
      : data.score >= 60
      ? 'Good — Room to Improve'
      : 'Needs Attention';

  const metricRow = (label: string, value: number) => {
    const color =
      value >= 70 ? '#22c55e' : value >= 50 ? '#f59e0b' : '#ef4444';
    const pct = Math.max(0, Math.min(100, value));
    return `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#94a3b8;width:140px;white-space:nowrap;">${label}</td>
      <td style="padding:8px 12px 8px 0;">
        <div style="background:#1e293b;border-radius:4px;height:8px;overflow:hidden;">
          <div style="width:${pct}%;background:${color};height:8px;border-radius:4px;"></div>
        </div>
      </td>
      <td style="padding:8px 0;font-size:13px;font-weight:700;color:${color};width:36px;text-align:right;">${value}</td>
    </tr>`;
  };

  const issueCard = (
    count: number,
    label: string,
    color: string,
    bg: string,
    border: string,
  ) => `
  <td style="text-align:center;padding:0 6px;">
    <div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:16px 10px;min-width:100px;">
      <div style="font-size:30px;font-weight:900;color:${color};line-height:1;">${count}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px;text-transform:uppercase;letter-spacing:0.06em;">${label}</div>
    </div>
  </td>`;

  const recItems = data.recommendations
    .map(
      (rec, i) => `
  <tr>
    <td style="padding:0 0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;width:30px;padding-top:2px;">
            <div style="width:22px;height:22px;background:linear-gradient(135deg,#1d4ed8,#7c3aed);border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#fff;">${i + 1}</div>
          </td>
          <td style="padding-left:10px;font-size:14px;color:#cbd5e1;line-height:1.6;">${rec}</td>
        </tr>
      </table>
    </td>
  </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Code Analysis Report</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#1d4ed8 0%,#7c3aed 100%);padding:40px;text-align:center;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.65);margin-bottom:10px;">
              AI Code Intelligence
            </div>
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.3px;">
              ${data.language} Analysis Report
            </h1>
            <p style="margin:10px 0 0;color:rgba(255,255,255,0.7);font-size:15px;">
              Prepared for <strong>${data.recipientName}</strong>
            </p>
          </td>
        </tr>

        <!-- SCORE -->
        <tr>
          <td style="padding:32px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#0f172a;border-radius:14px;padding:28px;text-align:center;border:1px solid #334155;">
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin-bottom:14px;">
                    Health Score
                  </div>
                  <div style="font-size:72px;font-weight:900;color:${scoreColor};line-height:1;">
                    ${data.score}
                  </div>
                  <div style="font-size:18px;color:#475569;margin-top:2px;">/ 100</div>
                  <div style="margin-top:14px;display:inline-block;font-size:13px;font-weight:700;color:${scoreColor};background:${scoreColor}22;padding:5px 18px;border-radius:20px;border:1px solid ${scoreColor}44;">
                    ${scoreMsg}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ISSUES BREAKDOWN -->
        <tr>
          <td style="padding:28px 40px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin-bottom:14px;">
              Issues Breakdown
            </div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${issueCard(data.criticalIssues, 'Critical', '#ef4444', '#1e0a0a', '#ef444440')}
                ${issueCard(data.highIssues,     'High',     '#f97316', '#1e100a', '#f9731640')}
                ${issueCard(data.mediumIssues,   'Medium',   '#eab308', '#1e1a0a', '#eab30840')}
                ${issueCard(data.lowIssues,      'Low',      '#3b82f6', '#0a0f1e', '#3b82f640')}
              </tr>
            </table>
          </td>
        </tr>

        <!-- QUALITY METRICS -->
        <tr>
          <td style="padding:28px 40px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin-bottom:14px;">
              Quality Metrics
            </div>
            <div style="background:#0f172a;border-radius:12px;padding:20px 24px;border:1px solid #334155;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${metricRow('Maintainability', data.metrics.maintainability)}
                ${metricRow('Security',        data.metrics.security)}
                ${metricRow('Performance',     data.metrics.performance)}
                ${metricRow('Readability',     data.metrics.readability)}
                ${metricRow('Documentation',   data.metrics.documentation)}
              </table>
            </div>
          </td>
        </tr>

        <!-- RECOMMENDATIONS -->
        <tr>
          <td style="padding:28px 40px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin-bottom:14px;">
              AI Recommendations
            </div>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${recItems}
            </table>
          </td>
        </tr>

        <!-- TECHNICAL DEBT -->
        <tr>
          <td style="padding:28px 40px 0;">
            <div style="background:#1c0a0022;border:1px solid #f9731640;border-radius:12px;padding:20px 24px;">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#f97316;margin-bottom:8px;">
                Technical Debt
              </div>
              <div style="font-size:14px;color:#cbd5e1;line-height:1.6;">
                ${data.technicalDebt}
              </div>
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:32px 40px;text-align:center;border-top:1px solid #334155;margin-top:32px;">
            <div style="font-size:13px;color:#475569;">
              Sent via <strong style="color:#94a3b8;">AI Code Intelligence</strong>
            </div>
            <div style="font-size:12px;color:#334155;margin-top:6px;">
              &copy; 2026 CodeIntel &bull; MKU Final Project
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// --------------------------------------------------------------------------
// Download email as HTML file
// --------------------------------------------------------------------------
export function downloadEmailHTML(html: string, recipientName: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `code-analysis-${recipientName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --------------------------------------------------------------------------
// Send email — uses Vite /mailer endpoint in dev, EmailJS in production
// --------------------------------------------------------------------------
export async function sendAnalysisEmail(
  data: EmailAnalysisData,
  htmlContent: string,
): Promise<void> {
  const subject = `${data.language} Code Analysis — Score: ${data.score}/100`;

  // In development, call the Vite dev-server /mailer endpoint (Gmail SMTP).
  if (import.meta.env.DEV) {
    const res = await fetch('/mailer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to:      data.recipientEmail,
        toName:  data.recipientName,
        subject,
        html:    htmlContent,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
      throw new Error(err.error ?? `Server error ${res.status}`);
    }
    return;
  }

  // In production, fall back to EmailJS if configured.
  if (!isEmailConfigured()) {
    throw new Error(
      'Email sending is not configured for production. Add VITE_EMAILJS_* keys to .env.local.',
    );
  }

  await emailjs.send(
    SERVICE_ID!,
    TEMPLATE_ID!,
    {
      to_name:      data.recipientName,
      to_email:     data.recipientEmail,
      subject,
      html_content: htmlContent,
    },
    PUBLIC_KEY!,
  );
}
