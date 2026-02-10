import { storage } from "./storage";

export async function sendSlackNotification(
  channelName: string,
  message: string
) {
  try {
    // Get all Slack configurations for the specified channel
    const configs = await storage.getSlackConfigurations();
    const channelConfig = configs.find(c => c.channelName === channelName);
    
    if (!channelConfig) {
      console.log(`No Slack webhook configured for channel ${channelName}`);
      return;
    }

    const payload = {
      text: message,
      channel: channelName,
    };

    const response = await fetch(channelConfig.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }

    console.log(`Slack notification sent to ${channelName}`);
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    // Don't throw - we don't want to fail the whole request if Slack fails
  }
}

export async function sendProposalAcceptedSlack(
  proposalTitle: string,
  companyName: string,
  contactName: string | null,
  contactEmail: string | null
) {
  const message = `*Proposal Accepted!*\n\n*Proposal:* ${proposalTitle}\n*Company:* ${companyName}${contactName ? `\n*Contact:* ${contactName}` : ''}${contactEmail ? `\n*Email:* ${contactEmail}` : ''}\n\nTime to get started!`;
  
  await sendSlackNotification('#accepted-proposals', message);
}
