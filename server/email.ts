import sgMail from '@sendgrid/mail';
import type { UatSession, UatChecklistItem, UatGuest, UatSessionCollaborator, UatChecklistItemStep, UatTestStepResult, UatTestRun } from '@shared/schema';
import { format } from 'date-fns';

function getSendGridClient() {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY environment variable is not set');
  }
  if (!fromEmail) {
    throw new Error('SENDGRID_FROM_EMAIL environment variable is not set');
  }

  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail,
  };
}

export async function sendProposalAcceptanceEmail(
  proposalTitle: string,
  companyName: string,
  contactName: string | null,
  contactEmail: string | null
) {
  const {client, fromEmail} = await getSendGridClient();
  
  const msg = {
    to: 'zach@patchops.io',
    cc: contactEmail || undefined,
    from: fromEmail,
    subject: `Proposal Accepted: ${proposalTitle}`,
    text: `Great news! ${companyName} has accepted the proposal "${proposalTitle}".\n\n${contactName ? `Contact: ${contactName}\n` : ''}${contactEmail ? `Email: ${contactEmail}\n` : ''}\n\nTime to celebrate and get started!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Proposal Accepted!</h2>
        <p><strong>${companyName}</strong> has accepted the proposal <strong>"${proposalTitle}"</strong>.</p>
        ${contactName ? `<p><strong>Contact:</strong> ${contactName}</p>` : ''}
        ${contactEmail ? `<p><strong>Email:</strong> ${contactEmail}</p>` : ''}
        <p style="margin-top: 20px; color: #6b7280;">Time to celebrate and get started!</p>
      </div>
    `,
  };

  await client.send(msg);
}

export interface UatEmailData {
  session: UatSession & { ownerEmail?: string; ownerName?: string };
  items: (UatChecklistItem & {
    steps?: UatChecklistItemStep[];
    stepResults?: UatTestStepResult[];
    itemStatus?: 'pending' | 'passed' | 'failed' | 'partial';
    passedSteps?: number;
    totalSteps?: number;
  })[];
  guests: UatGuest[];
  collaborators: UatSessionCollaborator[];
  customDomain?: string;
}

function getItemStatusBadge(status: string): string {
  const colors: Record<string, { bg: string; text: string }> = {
    passed: { bg: '#dcfce7', text: '#166534' },
    failed: { bg: '#fee2e2', text: '#991b1b' },
    pending: { bg: '#f3f4f6', text: '#374151' },
    partial: { bg: '#fef3c7', text: '#92400e' },
  };
  const c = colors[status] || colors.pending;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:500;background:${c.bg};color:${c.text}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  return format(new Date(date), 'MMM d, yyyy h:mm a');
}

export async function sendUatSessionUpdateEmail(data: UatEmailData): Promise<{ success: boolean; sentTo: string[]; error?: string }> {
  try {
    // Validate required data
    if (!data.session) {
      return { success: false, sentTo: [], error: 'Session data is required' };
    }
    if (!data.session.name) {
      return { success: false, sentTo: [], error: 'Session name is required' };
    }
    if (!Array.isArray(data.items)) {
      return { success: false, sentTo: [], error: 'Items must be an array' };
    }
    
    // Get SendGrid client with better error messaging
    let client, fromEmail;
    try {
      const result = await getSendGridClient();
      client = result.client;
      fromEmail = result.fromEmail;
    } catch (emailError) {
      console.error('Failed to initialize SendGrid client:', emailError);
      return { 
        success: false, 
        sentTo: [], 
        error: 'Email service not configured. Please connect SendGrid in the integrations panel.' 
      };
    }
    
    // Collect recipients
    const recipients: string[] = [];
    
    if (data.session.ownerEmail) {
      recipients.push(data.session.ownerEmail);
    }
    
    data.guests?.forEach(g => {
      if (g.email && !recipients.includes(g.email)) {
        recipients.push(g.email);
      }
    });
    
    data.collaborators?.forEach(c => {
      if (c.email && !recipients.includes(c.email)) {
        recipients.push(c.email);
      }
    });
    
    if (recipients.length === 0) {
      return { success: false, sentTo: [], error: 'No recipients found. Add guests or collaborators with email addresses.' };
    }

    // UAT links always use the custom domain for white-label branding
    const baseUrl = data.customDomain || process.env.UAT_CUSTOM_DOMAIN || 'https://testhub.us';
    
    const totalItems = data.items.length;
    const passedItems = data.items.filter(i => i.itemStatus === 'passed').length;
    const failedItems = data.items.filter(i => i.itemStatus === 'failed').length;
    const pendingItems = data.items.filter(i => i.itemStatus === 'pending').length;
    const partialItems = data.items.filter(i => i.itemStatus === 'partial').length;
    
    const itemRows = data.items.map(item => {
      const status = item.itemStatus || 'pending';
      const progress = item.totalSteps && item.totalSteps > 0 
        ? `${item.passedSteps || 0}/${item.totalSteps}` 
        : '-';
      
      return `
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:12px 8px;font-weight:500">${item.title}</td>
          <td style="padding:12px 8px;text-align:center">${getItemStatusBadge(status)}</td>
          <td style="padding:12px 8px;text-align:center">${progress}</td>
          <td style="padding:12px 8px;font-size:12px;color:#6b7280">${item.lastReviewedByName || '-'}</td>
          <td style="padding:12px 8px;font-size:12px;color:#6b7280">${formatDate(item.lastReviewedAt)}</td>
          <td style="padding:12px 8px;font-size:12px;color:#6b7280">${item.lastResolvedByName || '-'}</td>
          <td style="padding:12px 8px;font-size:12px;color:#6b7280">${formatDate(item.lastResolvedAt)}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb">
        <div style="max-width:800px;margin:0 auto;padding:24px">
          <div style="background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden">
            <div style="background:#1f2937;padding:24px;color:white">
              <h1 style="margin:0;font-size:20px;font-weight:600">UAT Session Update</h1>
              <p style="margin:8px 0 0;opacity:0.9;font-size:14px">${data.session.name}</p>
            </div>
            
            <div style="padding:24px">
              <div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap">
                <div style="background:#f3f4f6;padding:12px 16px;border-radius:6px;flex:1;min-width:120px">
                  <div style="font-size:24px;font-weight:600;color:#1f2937">${totalItems}</div>
                  <div style="font-size:12px;color:#6b7280">Total Items</div>
                </div>
                <div style="background:#dcfce7;padding:12px 16px;border-radius:6px;flex:1;min-width:120px">
                  <div style="font-size:24px;font-weight:600;color:#166534">${passedItems}</div>
                  <div style="font-size:12px;color:#166534">Passed</div>
                </div>
                <div style="background:#fee2e2;padding:12px 16px;border-radius:6px;flex:1;min-width:120px">
                  <div style="font-size:24px;font-weight:600;color:#991b1b">${failedItems}</div>
                  <div style="font-size:12px;color:#991b1b">Failed</div>
                </div>
                <div style="background:#fef3c7;padding:12px 16px;border-radius:6px;flex:1;min-width:120px">
                  <div style="font-size:24px;font-weight:600;color:#92400e">${partialItems}</div>
                  <div style="font-size:12px;color:#92400e">In Progress</div>
                </div>
                <div style="background:#f3f4f6;padding:12px 16px;border-radius:6px;flex:1;min-width:120px">
                  <div style="font-size:24px;font-weight:600;color:#6b7280">${pendingItems}</div>
                  <div style="font-size:12px;color:#6b7280">Pending</div>
                </div>
              </div>
              
              <h2 style="font-size:16px;font-weight:600;margin:0 0 12px;color:#1f2937">Item Status Details</h2>
              <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;font-size:14px">
                  <thead>
                    <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
                      <th style="padding:12px 8px;text-align:left;font-weight:600;color:#374151">Item</th>
                      <th style="padding:12px 8px;text-align:center;font-weight:600;color:#374151">Status</th>
                      <th style="padding:12px 8px;text-align:center;font-weight:600;color:#374151">Steps</th>
                      <th style="padding:12px 8px;text-align:left;font-weight:600;color:#374151">Last Reviewer</th>
                      <th style="padding:12px 8px;text-align:left;font-weight:600;color:#374151">Reviewed</th>
                      <th style="padding:12px 8px;text-align:left;font-weight:600;color:#374151">Resolved By</th>
                      <th style="padding:12px 8px;text-align:left;font-weight:600;color:#374151">Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemRows}
                  </tbody>
                </table>
              </div>
              
              <div style="margin-top:24px;padding-top:24px;border-top:1px solid #e5e7eb">
                <p style="margin:0;font-size:12px;color:#6b7280">
                  This is an automated update from your UAT review session. 
                  ${baseUrl ? `<a href="${baseUrl}" style="color:#2563eb">View Session</a>` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
UAT Session Update: ${data.session.name}

Summary:
- Total Items: ${totalItems}
- Passed: ${passedItems}
- Failed: ${failedItems}
- In Progress: ${partialItems}
- Pending: ${pendingItems}

Items:
${data.items.map(item => {
  const status = item.itemStatus || 'pending';
  const progress = item.totalSteps && item.totalSteps > 0 
    ? `${item.passedSteps || 0}/${item.totalSteps}` 
    : '-';
  return `- ${item.title}: ${status} (${progress} steps)
  Last Reviewed: ${item.lastReviewedByName || '-'} on ${formatDate(item.lastReviewedAt)}
  Resolved By: ${item.lastResolvedByName || '-'} on ${formatDate(item.lastResolvedAt)}`;
}).join('\n')}

${baseUrl ? `View Session: ${baseUrl}` : ''}
    `.trim();

    const msg = {
      to: recipients,
      from: fromEmail,
      subject: `UAT Update: ${data.session.name} - ${passedItems}/${totalItems} items passed`,
      text: textContent,
      html: html,
    };

    await client.send(msg);
    
    return { success: true, sentTo: recipients };
  } catch (error) {
    console.error('Failed to send UAT update email:', error);
    return { 
      success: false, 
      sentTo: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
