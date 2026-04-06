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

// Note: Email service now uses our custom /api/sendAnalysisReport backend (SMTP).


export function isEmailConfigured(): boolean {
  // We now use our custom /api/sendAnalysisReport backend for all environments.
  return true;
}

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
export interface EmailIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  line?: number;
  suggestion?: string;
}

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
  issues: EmailIssue[];
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
  const scoreColor = data.score >= 80 ? '#10b981' : data.score >= 60 ? '#f59e0b' : '#ef4444';
  const scoreLabel = data.score >= 80 ? 'Great shape' : data.score >= 60 ? 'Room to improve' : 'Needs attention';
  const totalIssues = data.criticalIssues + data.highIssues + data.mediumIssues + data.lowIssues;

  const metricBar = (label: string, value: number) => {
    const color = value >= 70 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444';
    return `
      <tr>
        <td style="padding:9px 0;font-size:13px;color:#94a3b8;width:130px;white-space:nowrap;">${label}</td>
        <td style="padding:9px 16px 9px 0;">
          <div style="background:#1e293b;border-radius:99px;height:6px;">
            <div style="width:${value}%;background:${color};height:6px;border-radius:99px;"></div>
          </div>
        </td>
        <td style="padding:9px 0;width:32px;text-align:right;font-size:13px;font-weight:700;color:${color};">${value}</td>
      </tr>`;
  };

  const severityBadge = (count: number, label: string, bg: string, text: string) =>
    count > 0 ? `<td style="padding:0 6px 0 0;">
      <div style="display:inline-block;background:${bg};border-radius:6px;padding:6px 14px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:${text};line-height:1.1;">${count}</div>
        <div style="font-size:10px;color:${text};opacity:0.75;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px;">${label}</div>
      </div>
    </td>` : '';

  const recList = data.recommendations.map((r, i) => `
    <tr>
      <td style="vertical-align:top;width:22px;padding:0 0 11px;font-size:13px;color:#475569;font-weight:600;">${i + 1}.</td>
      <td style="padding:0 0 11px 8px;font-size:14px;color:#cbd5e1;line-height:1.65;">${r}</td>
    </tr>`).join('');

  const severityStyles: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    critical: { bg: 'rgba(239,68,68,0.08)',  border: '#7f1d1d', text: '#f87171', dot: '#ef4444' },
    high:     { bg: 'rgba(249,115,22,0.08)', border: '#7c2d12', text: '#fb923c', dot: '#f97316' },
    medium:   { bg: 'rgba(234,179,8,0.08)',  border: '#713f12', text: '#fbbf24', dot: '#eab308' },
    low:      { bg: 'rgba(148,163,184,0.06)',border: '#1e293b', text: '#94a3b8', dot: '#64748b' },
  };

  // Show critical + high first, then medium, then low — cap at 20 total
  const sortedIssues = [...data.issues].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  }).slice(0, 20);

  const issueRows = sortedIssues.map(issue => {
    const s = severityStyles[issue.severity] || severityStyles.low;
    return `
    <tr>
      <td style="padding:0 0 8px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${s.bg};border:1px solid ${s.border};border-radius:8px;">
          <tr>
            <td style="padding:12px 16px;">
              <!-- Severity + category row -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
                <tr>
                  <td style="vertical-align:middle;padding-right:8px;">
                    <div style="width:8px;height:8px;border-radius:50%;background:${s.dot};display:inline-block;"></div>
                  </td>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <span style="font-size:10px;font-weight:700;color:${s.text};text-transform:uppercase;letter-spacing:0.08em;">${issue.severity}</span>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.06em;">${issue.category}</span>
                  </td>
                  ${issue.line ? `<td style="vertical-align:middle;padding-left:10px;"><span style="font-size:10px;color:#334155;">Line ${issue.line}</span></td>` : ''}
                </tr>
              </table>
              <!-- Message -->
              <p style="margin:0 0 ${issue.suggestion ? '8px' : '0'};font-size:13px;color:#e2e8f0;line-height:1.55;">${issue.message}</p>
              ${issue.suggestion ? `<p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;"><span style="color:#4ade80;font-weight:600;">Fix: </span>${issue.suggestion}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Code Review — ${data.language}</title>
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- HEADER -->
  <tr>
    <td style="padding:0 0 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <span style="font-size:16px;font-weight:700;color:#f1f5f9;letter-spacing:-0.3px;">Intellicode</span>
          </td>
          <td style="text-align:right;">
            <span style="font-size:12px;color:#475569;">Code Analysis Report</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- HERO CARD -->
  <tr>
    <td style="background:#161b22;border-radius:12px 12px 0 0;border:1px solid #21262d;border-bottom:none;padding:36px 40px 32px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.1em;">${data.language} &nbsp;·&nbsp; Code Review</p>
      <h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#f1f5f9;letter-spacing:-0.5px;line-height:1.2;">Hi ${data.recipientName},<br>here's your report.</h1>

      <!-- SCORE ROW -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <div style="font-size:56px;font-weight:900;color:${scoreColor};line-height:1;letter-spacing:-2px;">${data.score}<span style="font-size:22px;color:#475569;font-weight:500;letter-spacing:0;">/100</span></div>
            <div style="margin-top:6px;font-size:13px;color:#64748b;">${scoreLabel} &nbsp;·&nbsp; ${totalIssues} issue${totalIssues !== 1 ? 's' : ''} found</div>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <!-- Score arc visual using a simple border trick -->
            <div style="width:72px;height:72px;border-radius:50%;border:5px solid #1e293b;border-top-color:${scoreColor};display:inline-block;"></div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SEVERITY STRIP -->
  ${totalIssues > 0 ? `<tr>
    <td style="background:#0d1117;border-left:1px solid #21262d;border-right:1px solid #21262d;padding:20px 40px;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          ${severityBadge(data.criticalIssues, 'Critical', 'rgba(239,68,68,0.12)', '#f87171')}
          ${severityBadge(data.highIssues,     'High',     'rgba(249,115,22,0.12)', '#fb923c')}
          ${severityBadge(data.mediumIssues,   'Medium',   'rgba(234,179,8,0.10)',  '#fbbf24')}
          ${severityBadge(data.lowIssues,      'Low',      'rgba(148,163,184,0.08)','#94a3b8')}
        </tr>
      </table>
    </td>
  </tr>` : ''}

  <!-- ISSUES -->
  ${sortedIssues.length > 0 ? `<tr>
    <td style="background:#161b22;border:1px solid #21262d;border-top:1px solid #21262d;border-bottom:none;padding:28px 40px;">
      <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.1em;">Issues Found (${sortedIssues.length}${data.issues.length > 20 ? ' of ' + data.issues.length : ''})</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${issueRows}
      </table>
    </td>
  </tr>` : ''}

  <!-- METRICS -->
  <tr>
    <td style="background:#161b22;border:1px solid #21262d;border-top:none;border-bottom:none;padding:28px 40px;">
      <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.1em;">Quality Metrics</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${metricBar('Maintainability', data.metrics.maintainability)}
        ${metricBar('Security',        data.metrics.security)}
        ${metricBar('Performance',     data.metrics.performance)}
        ${metricBar('Readability',     data.metrics.readability)}
        ${metricBar('Documentation',   data.metrics.documentation)}
      </table>
    </td>
  </tr>

  <!-- RECOMMENDATIONS -->
  ${data.recommendations.length > 0 ? `<tr>
    <td style="background:#161b22;border:1px solid #21262d;border-top:1px solid #21262d;border-bottom:none;padding:28px 40px;">
      <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.1em;">Recommendations</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${recList}
      </table>
    </td>
  </tr>` : ''}

  <!-- TECHNICAL DEBT -->
  ${data.technicalDebt ? `<tr>
    <td style="background:#161b22;border:1px solid #21262d;border-top:1px solid #21262d;border-bottom:none;padding:20px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <span style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.1em;">Estimated Fix Time</span>
            <div style="margin-top:4px;font-size:15px;font-weight:600;color:#f59e0b;">${data.technicalDebt}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>` : ''}

  <!-- FOOTER CARD -->
  <tr>
    <td style="background:#161b22;border:1px solid #21262d;border-top:1px solid #21262d;border-radius:0 0 12px 12px;padding:20px 40px;">
      <p style="margin:0;font-size:13px;color:#475569;line-height:1.7;">
        Open <strong style="color:#94a3b8;">Intellicode</strong> in your browser to view the full analysis, apply auto-fixes, and re-run the review.
      </p>
    </td>
  </tr>

  <!-- BOTTOM META -->
  <tr>
    <td style="padding:24px 0 0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#334155;">Intellicode &nbsp;&middot;&nbsp; &copy; 2026 &nbsp;&middot;&nbsp; MKU Final Project</p>
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

  // Always use the backend endpoint for both local dev and production.
  // We use '/api/sendAnalysisReport' for Vercel.
  const endpoint = import.meta.env.DEV ? '/mailer' : '/api/sendAnalysisReport';

  const res = await fetch(endpoint, {
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
}
