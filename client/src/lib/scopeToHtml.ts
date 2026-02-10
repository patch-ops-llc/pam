interface ScopeItem {
  storyId: string;
  hours: number;
  workstream: string;
  customerStory: string;
  recommendedApproach: string;
  assumptions: string;
  order: number;
}

export function convertScopeToHTML(scopeItems: ScopeItem[]): string {
  if (scopeItems.length === 0) {
    return '<p>No scope items provided.</p>';
  }

  const sortedItems = [...scopeItems].sort((a, b) => a.order - b.order);
  
  const workstreamGroups = sortedItems.reduce((groups, item) => {
    const workstream = item.workstream || 'General';
    if (!groups[workstream]) {
      groups[workstream] = [];
    }
    groups[workstream].push(item);
    return groups;
  }, {} as Record<string, ScopeItem[]>);

  const totalHours = sortedItems.reduce((sum, item) => sum + Number(item.hours), 0);

  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scope of Work</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
      background-color: #f9fafb;
    }
    h1 {
      color: #1a1a1a;
      font-size: 2.5em;
      margin-bottom: 0.5em;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 0.3em;
    }
    h2 {
      color: #1f2937;
      font-size: 1.8em;
      margin-top: 1.5em;
      margin-bottom: 0.8em;
      border-left: 4px solid #2563eb;
      padding-left: 12px;
    }
    .summary {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .summary-item {
      display: inline-block;
      margin-right: 30px;
      font-size: 1.1em;
    }
    .summary-label {
      font-weight: 600;
      color: #6b7280;
    }
    .summary-value {
      font-weight: 700;
      color: #2563eb;
      font-size: 1.2em;
    }
    .scope-item {
      background: white;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-left: 4px solid #3b82f6;
    }
    .scope-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .story-id {
      font-family: 'Courier New', monospace;
      font-weight: 700;
      font-size: 1.1em;
      color: #1f2937;
      background: #f3f4f6;
      padding: 4px 12px;
      border-radius: 4px;
    }
    .hours-badge {
      background: #2563eb;
      color: white;
      font-weight: 600;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 0.95em;
    }
    .workstream-badge {
      background: #10b981;
      color: white;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 0.9em;
      margin-left: 12px;
    }
    .scope-section {
      margin-bottom: 16px;
    }
    .scope-section-title {
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      font-size: 0.85em;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .scope-section-content {
      color: #374151;
      line-height: 1.7;
      white-space: pre-wrap;
    }
    .workstream-group {
      margin-top: 30px;
    }
    @media print {
      body {
        background: white;
      }
      .scope-item {
        box-shadow: none;
        border: 1px solid #e5e7eb;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <h1>Scope of Work</h1>
  
  <div class="summary">
    <div class="summary-item">
      <span class="summary-label">Total Items:</span>
      <span class="summary-value">${sortedItems.length}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Estimated Hours:</span>
      <span class="summary-value">${totalHours}h</span>
    </div>
  </div>
`;

  Object.entries(workstreamGroups).forEach(([workstream, items]) => {
    if (items.length > 0) {
      const workstreamHours = items.reduce((sum, item) => sum + Number(item.hours), 0);
      html += `
  <div class="workstream-group">
    <h2>${workstream} <span style="font-size: 0.7em; color: #6b7280;">(${items.length} items, ${workstreamHours}h)</span></h2>
`;
      
      items.forEach(item => {
        html += `
    <div class="scope-item">
      <div class="scope-header">
        <div>
          <span class="story-id">${item.storyId}</span>
          <span class="workstream-badge">${item.workstream}</span>
        </div>
        <span class="hours-badge">${Number(item.hours)} hours</span>
      </div>
      
      <div class="scope-section">
        <div class="scope-section-title">User Story</div>
        <div class="scope-section-content">${escapeHtml(item.customerStory)}</div>
      </div>
      
      <div class="scope-section">
        <div class="scope-section-title">Recommended Approach</div>
        <div class="scope-section-content">${escapeHtml(item.recommendedApproach)}</div>
      </div>
      
      <div class="scope-section">
        <div class="scope-section-title">Assumptions</div>
        <div class="scope-section-content">${escapeHtml(item.assumptions)}</div>
      </div>
    </div>
`;
      });
      
      html += `
  </div>
`;
    }
  });

  html += `
</body>
</html>`;

  return html;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, char => map[char] || char);
}

export function generateSimpleHTML(scopeItems: ScopeItem[], title: string = "Scope of Work"): string {
  const sortedItems = [...scopeItems].sort((a, b) => a.order - b.order);
  const totalHours = sortedItems.reduce((sum, item) => sum + item.hours, 0);

  let html = `<h1>${title}</h1>\n`;
  html += `<p><strong>Total Scope Items:</strong> ${sortedItems.length} | <strong>Estimated Hours:</strong> ${totalHours}</p>\n`;
  html += `<hr />\n\n`;

  sortedItems.forEach((item, index) => {
    html += `<h3>${index + 1}. ${item.storyId} - ${item.workstream} (${item.hours}h)</h3>\n`;
    html += `<p><strong>User Story:</strong><br />${escapeHtml(item.customerStory)}</p>\n`;
    html += `<p><strong>Approach:</strong><br />${escapeHtml(item.recommendedApproach)}</p>\n`;
    html += `<p><strong>Assumptions:</strong><br />${escapeHtml(item.assumptions)}</p>\n`;
    html += `<hr />\n\n`;
  });

  return html;
}
