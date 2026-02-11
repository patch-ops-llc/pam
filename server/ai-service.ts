import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import type { 
  ProposalScopeItem, 
  KnowledgeBaseDocument, 
  GuidanceSetting 
} from "@shared/schema";

async function parsePdf(buffer: Buffer): Promise<{ text: string }> {
  const pdfParse = (await import("pdf-parse")).default;
  return pdfParse(buffer);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface GenerateScopeRequest {
  chatTranscript: string;
  knowledgeBase: KnowledgeBaseDocument[];
  guidanceSettings: GuidanceSetting[];
  generalInstructions?: string;
  companyName?: string;
  previousProposals?: {
    title: string;
    companyName: string;
    htmlContent: string;
  }[];
  projectContext?: {
    projectName?: string;
    accountName?: string;
    existingRequirements?: string;
  };
}

export interface GeneratedScopeItem {
  storyId: string;
  hours: number;
  workstream: string;
  customerStory: string;
  recommendedApproach: string;
  assumptions: string;
  order: number;
}

export interface ExtractedProposalMetadata {
  title?: string;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  engagementTimeline?: string;
}

export class AIService {
  private buildSystemPrompt(guidanceSettings: GuidanceSetting[], generalInstructions?: string, companyName?: string): string {
    let prompt = `You are an expert technical scoping assistant. Your task is to analyze client conversations and generate detailed scopes of work for software development projects.

Your output should be structured scope items, each containing:
- Story ID: A unique identifier (e.g., US-001, FEAT-001)
- Hours: Estimated hours for implementation (MUST be multiples of 5)
- Workstream: Clean, consistent category name (e.g., "Frontend", "Backend", "CRM Setup", "Analytics", "Marketing Automation")
- Customer Story: ${companyName ? `What ${companyName} wants or needs` : 'What the company wants or needs'} (e.g., "${companyName ? companyName : 'Acme Corp'} wants to track marketing attribution across all channels")
- Recommended Approach: Technical approach and implementation details (formatted as bullet points)
- Assumptions: Any assumptions made during estimation (formatted as bullet points)

CRITICAL REQUIREMENTS:
1. ALL hour estimates MUST be multiples of 5 (5, 10, 15, 20, etc.)
2. Format Recommended Approach as bullet points (use "• " prefix for each point)
3. Format Assumptions as bullet points (use "• " prefix for each point)
4. Workstream names MUST be clean and consistent:
   - Use simple, professional names like "CRM Setup", "Website Integration", "Marketing Automation", "Analytics", "Reporting"
   - Do NOT include company names in workstream titles (e.g., use "CRM Setup" not "Acme CRM Setup")
   - Keep them short and descriptive
   - Group related work under the same workstream name
5. Customer stories MUST use the format "${companyName ? companyName : '[Company]'} wants to..." or "${companyName ? companyName : '[Company]'} needs to...":
   - Good: "${companyName ? companyName : 'Acme Corp'} wants to track which campaigns drive appointments"
   - Good: "${companyName ? companyName : 'Acme Corp'} needs automated follow-up sequences for leads"
   - Bad: "As a practice owner, I want to track campaigns"
   - Bad: "As an X, I want to Y so that Z"
6. ALWAYS include scope items for Project Management and Testing at the end:
   - Project Management: Include planning, meetings, communication, and coordination
   - Testing: Include QA, user acceptance testing, and bug fixes

Additional Guidelines:
1. Parse the chat transcript carefully to identify distinct requirements
2. Break down complex features into smaller, manageable scope items
3. CRITICAL: Use the reference examples from past proposals (if provided below) as a PRIMARY guide for hour estimation
   - Match similar features to comparable items in the knowledge base
   - If a reference example shows 40 hours for authentication, use similar sizing
   - Don't underestimate - the knowledge base reflects realistic, tested estimates
4. Provide realistic hour estimates based on standard development practices and reference examples
5. Be specific and actionable in your recommendations
6. Clearly state any assumptions that affect the estimate

`;

    if (generalInstructions) {
      prompt += `\nGeneral Instructions for this scope:\n${generalInstructions}\n\n`;
    }

    if (guidanceSettings.length > 0) {
      prompt += "\nAdditional Guidance:\n";
      guidanceSettings
        .sort((a, b) => a.order - b.order)
        .forEach(setting => {
          prompt += `\n${setting.name}:\n${setting.content}\n`;
        });
      
      // Re-emphasize multiples of 5 after guidance settings
      prompt += "\n⚠️ CRITICAL REMINDER: ALL hour estimates MUST be multiples of 5. No exceptions.\n";
      prompt += "Examples: Use 5, 10, 15, 20, 25, etc. NEVER use 3, 7, 12, 18, 23, etc.\n";
    }

    return prompt;
  }

  private buildKnowledgeBaseContext(knowledgeBase: KnowledgeBaseDocument[]): string {
    if (knowledgeBase.length === 0) {
      return "";
    }

    let context = "\n\nReference Examples from Past Proposals:\n";
    context += "Use these as reference for scope structure, estimation approaches, and terminology.\n\n";

    knowledgeBase.forEach((doc, index) => {
      context += `Example ${index + 1}: ${doc.title}\n`;
      context += `Company: ${doc.companyName}\n`;
      if (doc.projectType) {
        context += `Project Type: ${doc.projectType}\n`;
      }
      const content = doc.extractedText || doc.htmlContent;
      context += `Content:\n${content}\n\n`;
      context += "---\n\n";
    });

    return context;
  }

  private buildUserPrompt(request: GenerateScopeRequest): string {
    let prompt = "";

    if (request.previousProposals && request.previousProposals.length > 0) {
      prompt += "Previous Proposal Context (for Phase 2/Update):\n";
      request.previousProposals.forEach((prev, index) => {
        prompt += `\nProposal ${index + 1}:\n`;
        prompt += `Title: ${prev.title}\n`;
        prompt += `Company: ${prev.companyName}\n`;
        prompt += `Previous Scope:\n${prev.htmlContent}\n`;
        prompt += "---\n";
      });
      prompt += "\nThis is a follow-up proposal. Consider the previous work from all referenced proposals when creating this scope.\n\n";
    }

    if (request.projectContext) {
      prompt += "Project Context:\n";
      if (request.projectContext.projectName) {
        prompt += `Project Name: ${request.projectContext.projectName}\n`;
      }
      if (request.projectContext.accountName) {
        prompt += `Client: ${request.projectContext.accountName}\n`;
      }
      if (request.projectContext.existingRequirements) {
        prompt += `Existing Requirements: ${request.projectContext.existingRequirements}\n`;
      }
      prompt += "\n";
    }

    prompt += "Chat Transcript:\n";
    prompt += request.chatTranscript;
    prompt += "\n\n";

    const kbContext = this.buildKnowledgeBaseContext(request.knowledgeBase);
    if (kbContext) {
      prompt += kbContext;
    }

    prompt += `
Based on the above conversation${request.previousProposals && request.previousProposals.length > 0 ? ' and previous proposal context' : ''}, generate a comprehensive scope of work. 

Output your response as a JSON array of scope items. Each item should have this exact structure:
{
  "storyId": "string",
  "hours": number,
  "workstream": "string",
  "customerStory": "string",
  "recommendedApproach": "string",
  "assumptions": "string",
  "order": number
}

Respond ONLY with the JSON array, no additional text or markdown formatting.`;

    return prompt;
  }

  private roundToMultipleOf5(hours: number): number {
    return Math.max(5, Math.round(hours / 5) * 5);
  }

  private ensurePMAndTestingItems(scopeItems: GeneratedScopeItem[]): GeneratedScopeItem[] {
    const hasPM = scopeItems.some(item => 
      item.workstream.toLowerCase().includes('project management') ||
      item.customerStory.toLowerCase().includes('project management')
    );
    
    const hasTesting = scopeItems.some(item => 
      item.workstream.toLowerCase().includes('testing') ||
      item.workstream.toLowerCase().includes('qa') ||
      item.customerStory.toLowerCase().includes('testing')
    );

    const result = [...scopeItems];
    let nextOrder = scopeItems.length > 0 ? Math.max(...scopeItems.map(item => item.order)) + 1 : 0;

    if (!hasPM) {
      result.push({
        storyId: `PM-001`,
        hours: 20,
        workstream: "Project Management",
        customerStory: "The client needs effective project management to ensure successful delivery and clear communication throughout the engagement",
        recommendedApproach: "• Weekly planning and status meetings\n• Regular client communication and updates\n• Sprint planning and retrospectives\n• Risk management and mitigation\n• Documentation and reporting",
        assumptions: "• Weekly meetings with stakeholders\n• Standard agile methodology\n• Regular status updates required",
        order: nextOrder++,
      });
    }

    if (!hasTesting) {
      result.push({
        storyId: `TEST-001`,
        hours: 30,
        workstream: "Testing & QA",
        customerStory: "The client needs comprehensive testing to ensure the system works correctly and meets all requirements",
        recommendedApproach: "• Unit testing for critical components\n• Integration testing\n• User acceptance testing (UAT)\n• Bug fixes and refinement\n• Performance and security testing",
        assumptions: "• Client will provide UAT feedback\n• Standard testing coverage expected\n• Bug fixes included in estimate",
        order: nextOrder,
      });
    }

    return result;
  }

  async generateScope(request: GenerateScopeRequest): Promise<GeneratedScopeItem[]> {
    const systemPrompt = this.buildSystemPrompt(request.guidanceSettings, request.generalInstructions, request.companyName);
    const userPrompt = this.buildUserPrompt(request);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const responseText = message.content[0].type === "text" 
      ? message.content[0].text 
      : "";

    try {
      const cleanedResponse = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      
      const scopeItems = JSON.parse(cleanedResponse);
      
      if (!Array.isArray(scopeItems)) {
        throw new Error("Response is not an array");
      }

      let items = scopeItems.map((item, index) => ({
        storyId: item.storyId || `ITEM-${index + 1}`,
        hours: this.roundToMultipleOf5(typeof item.hours === "number" ? item.hours : 5),
        workstream: item.workstream || "General",
        customerStory: item.customerStory || "",
        recommendedApproach: item.recommendedApproach || "",
        assumptions: item.assumptions || "",
        order: typeof item.order === "number" ? item.order : index,
      }));

      // Ensure PM and Testing items are included
      items = this.ensurePMAndTestingItems(items);

      return items;
    } catch (error) {
      console.error("Failed to parse AI response:", error);
      console.error("Raw response:", responseText);
      throw new Error("Failed to parse AI-generated scope. Please try again.");
    }
  }

  async refineScope(
    existingScopeItems: GeneratedScopeItem[],
    refinementInstructions: string,
    guidanceSettings: GuidanceSetting[],
    companyName?: string
  ): Promise<GeneratedScopeItem[]> {
    const systemPrompt = this.buildSystemPrompt(guidanceSettings, undefined, companyName);
    
    const userPrompt = `Here is an existing scope of work:

${JSON.stringify(existingScopeItems, null, 2)}

Please refine this scope based on the following instructions:
${refinementInstructions}

REMEMBER:
- ALL hour estimates MUST be multiples of 5
- Format Recommended Approach as bullet points (use "• " prefix)
- Format Assumptions as bullet points (use "• " prefix)
- Maintain Project Management and Testing items

Output your response as a JSON array of scope items with the same structure. Respond ONLY with the JSON array, no additional text or markdown formatting.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const responseText = message.content[0].type === "text" 
      ? message.content[0].text 
      : "";

    try {
      const cleanedResponse = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      
      const scopeItems = JSON.parse(cleanedResponse);
      
      if (!Array.isArray(scopeItems)) {
        throw new Error("Response is not an array");
      }

      let items = scopeItems.map((item, index) => ({
        storyId: item.storyId || `ITEM-${index + 1}`,
        hours: this.roundToMultipleOf5(typeof item.hours === "number" ? item.hours : 5),
        workstream: item.workstream || "General",
        customerStory: item.customerStory || "",
        recommendedApproach: item.recommendedApproach || "",
        assumptions: item.assumptions || "",
        order: typeof item.order === "number" ? item.order : index,
      }));

      // Ensure PM and Testing items are still included
      items = this.ensurePMAndTestingItems(items);

      return items;
    } catch (error) {
      console.error("Failed to parse AI response:", error);
      console.error("Raw response:", responseText);
      throw new Error("Failed to parse AI-refined scope. Please try again.");
    }
  }

  async extractProposalMetadata(chatTranscript: string): Promise<ExtractedProposalMetadata> {
    const systemPrompt = `You are an expert at extracting structured information from client conversations. Extract proposal metadata from the transcript provided.`;
    
    const userPrompt = `Analyze this client conversation and extract the following information:

Chat Transcript:
${chatTranscript}

Extract and return ONLY a JSON object with these fields (use null for any field you cannot confidently extract):
{
  "title": "A descriptive project title based on what's being discussed",
  "companyName": "The client's company name",
  "contactName": "The primary contact person's name",
  "contactEmail": "The contact's email address",
  "engagementTimeline": "Any mentioned timeline or target dates"
}

Be conservative - only include information that is explicitly stated or strongly implied. Return ONLY the JSON object, no additional text or markdown formatting.`;

    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        temperature: 0.1,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      });

      const responseText = message.content[0].type === "text" 
        ? message.content[0].text 
        : "";

      const cleanedResponse = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      
      const metadata = JSON.parse(cleanedResponse);
      
      return {
        title: metadata.title || undefined,
        companyName: metadata.companyName || undefined,
        contactName: metadata.contactName || undefined,
        contactEmail: metadata.contactEmail || undefined,
        engagementTimeline: metadata.engagementTimeline || undefined,
      };
    } catch (error) {
      console.error("Failed to parse AI metadata extraction:", error);
      return {};
    }
  }

  async generateCopilotResponse(
    prompt: string,
    currentContent: string,
    context: {
      title?: string;
      companyName?: string;
      templateType?: string;
    }
  ): Promise<string> {
    const systemPrompt = `You are an expert proposal writing assistant helping create professional business proposals. 

Context about the current proposal:
- Title: ${context.title || "Not yet set"}
- Company/Client: ${context.companyName || "Not yet set"}
- Type: ${context.templateType || "project"}

Your role is to help the user write compelling, professional proposal content. When generating content:
1. Be professional and clear
2. Use appropriate formatting (headings, bullet points, numbered lists)
3. Be specific and actionable
4. Focus on value proposition and client benefits
5. Keep the tone confident but not arrogant
6. Use industry-standard terminology

When expanding or rewriting content, maintain the original intent while improving clarity and impact.

Output your response as clean HTML that can be directly inserted into a rich text editor. Use appropriate HTML tags:
- <h2> for section headings
- <h3> for subsection headings
- <p> for paragraphs
- <ul>/<li> for bullet lists
- <ol>/<li> for numbered lists
- <strong> for emphasis

Do NOT include any markdown formatting - only valid HTML.`;

    const userPrompt = currentContent 
      ? `Current proposal content:\n${currentContent}\n\nUser request: ${prompt}`
      : `User request: ${prompt}`;

    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      });

      const responseText = message.content[0].type === "text" 
        ? message.content[0].text 
        : "";

      return responseText;
    } catch (error) {
      console.error("Failed to generate copilot response:", error);
      throw new Error("Failed to generate AI response. Please try again.");
    }
  }

  async parseDocumentContent(
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<{ text: string; html?: string }> {
    if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
      const data = await parsePdf(fileBuffer);
      return { text: data.text };
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      const result = await mammoth.convertToHtml({ buffer: fileBuffer });
      return { text: "", html: result.value };
    } else if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
      const text = fileBuffer.toString("utf-8");
      return { text };
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  }

  async convertDocumentToProposal(
    content: string,
    isHtml: boolean,
    branding: {
      font?: string;
      primaryColor?: string;
      secondaryColor?: string;
      accentColor?: string;
    }
  ): Promise<{
    htmlContent: string;
    metadata: ExtractedProposalMetadata;
  }> {
    const systemPrompt = `You are an expert proposal formatter. Your task is to convert document content into a beautifully structured HTML proposal.

CRITICAL: You must output valid HTML that will be rendered in a rich text editor. Use these HTML elements:
- <h1> for the main title (use only once at the top)
- <h2> for major section headings
- <h3> for subsection headings
- <p> for paragraphs
- <ul>/<li> for unordered lists
- <ol>/<li> for ordered lists
- <strong> for bold emphasis
- <em> for italic emphasis
- <blockquote> for quotes or callouts

Structure the proposal professionally with clear sections. Common proposal sections include:
- Executive Summary
- Overview/Introduction
- Scope of Work
- Deliverables
- Timeline
- Pricing/Investment
- Terms & Conditions
- About Us/Team

IMPORTANT FORMATTING RULES:
1. Preserve all meaningful content from the original document
2. Improve formatting and structure for readability
3. Add appropriate section headings if the document lacks them
4. Convert bullet points and numbered lists to proper HTML lists
5. Do NOT add content that wasn't in the original - only restructure and format
6. Do NOT include markdown - only valid HTML
7. Do NOT include any CSS or style attributes - the system will apply branding

Also extract metadata from the content. Return your response in this JSON format:
{
  "htmlContent": "<h1>Title</h1>...",
  "metadata": {
    "title": "Extracted or inferred proposal title",
    "companyName": "Client/prospect company name if mentioned",
    "contactName": "Contact person if mentioned",
    "contactEmail": "Email if mentioned",
    "engagementTimeline": "Timeline if mentioned"
  }
}`;

    const userPrompt = isHtml
      ? `Convert this HTML document into a well-structured proposal. The source is already HTML but may need restructuring:\n\n${content}`
      : `Convert this text document into a well-structured HTML proposal:\n\n${content}`;

    console.log("[convertDocumentToProposal] Starting AI conversion:", {
      contentLength: content.length,
      isHtml,
      contentPreview: content.substring(0, 300)
    });

    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      });

      const responseText = message.content[0].type === "text" 
        ? message.content[0].text 
        : "";

      console.log("[convertDocumentToProposal] AI response received:", {
        responseLength: responseText.length,
        stopReason: message.stop_reason,
        usage: message.usage,
        responsePreview: responseText.substring(0, 500)
      });

      const cleanedResponse = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      
      const result = JSON.parse(cleanedResponse);
      
      console.log("[convertDocumentToProposal] Parsed result:", {
        htmlContentLength: result.htmlContent?.length || 0,
        hasMetadata: !!result.metadata,
        title: result.metadata?.title
      });
      
      return {
        htmlContent: result.htmlContent || "",
        metadata: {
          title: result.metadata?.title || undefined,
          companyName: result.metadata?.companyName || undefined,
          contactName: result.metadata?.contactName || undefined,
          contactEmail: result.metadata?.contactEmail || undefined,
          engagementTimeline: result.metadata?.engagementTimeline || undefined,
        },
      };
    } catch (error) {
      console.error("Failed to convert document to proposal:", error);
      throw new Error("Failed to convert document. Please try again.");
    }
  }

  async enrichLeadFromLinkedIn(linkedInUrl: string): Promise<{
    contactName?: string;
    contactTitle?: string;
    contactEmail?: string;
    company?: string;
    notes?: string;
  }> {
    // Extract LinkedIn username from URL for context
    const usernameMatch = linkedInUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
    const username = usernameMatch ? usernameMatch[1] : linkedInUrl;

    const prompt = `You are analyzing a LinkedIn profile URL to help enrich a sales lead record.

LinkedIn Profile URL: ${linkedInUrl}
${username ? `Extracted username: ${username}` : ''}

Based on the LinkedIn username/URL pattern, generate REALISTIC and PROFESSIONAL enrichment data for a B2B sales CRM. 

IMPORTANT: Since you cannot actually access LinkedIn, you should:
1. Parse the username for name patterns (e.g., "john-doe-123" → "John Doe")
2. Generate a professional summary based on typical B2B contexts
3. Do NOT fabricate specific company names, emails, or phone numbers you cannot verify

Return a JSON object with these fields (leave empty string if uncertain):
{
  "contactName": "Full name extracted or inferred from username",
  "contactTitle": "",
  "contactEmail": "",
  "company": "",
  "notes": "Brief professional context note based on the LinkedIn URL pattern. Include that this was enriched from LinkedIn and the profile should be reviewed for accuracy."
}

Return ONLY valid JSON, no markdown formatting.`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type");
      }

      // Parse the JSON response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const result = JSON.parse(jsonMatch[0]);
      return {
        contactName: result.contactName || undefined,
        contactEmail: result.contactEmail || undefined,
        company: result.company || undefined,
        notes: result.notes || undefined,
      };
    } catch (error) {
      console.error("Failed to enrich lead from LinkedIn:", error);
      throw new Error("Failed to enrich lead. Please try again.");
    }
  }

  async generateTrainingProgram(prompt: string): Promise<{ program: Record<string, unknown>; phases: Array<Record<string, unknown>> }> {
    const systemPrompt = `You are an expert instructional designer. Your task is to generate a complete training program structure based on the user's description.

Output a JSON object with this exact structure:
{
  "program": {
    "title": "string",
    "description": "string",
    "philosophy": "string (optional - learning approach)",
    "prerequisites": "string (optional)",
    "estimatedHours": "string (e.g. '40-60')",
    "status": "draft",
    "order": 0
  },
  "phases": [
    {
      "title": "string",
      "description": "string",
      "estimatedHours": "string (optional)",
      "milestoneReview": "string (optional)",
      "passCriteria": "string (optional)",
      "order": 0,
      "modules": [
        {
          "title": "string",
          "estimatedHours": "string (optional)",
          "clientStory": "string (the business context and scenario)",
          "assignment": "string (goals and key decisions)",
          "testingRequirements": "string (optional)",
          "deliverablesAndPresentation": "string (optional)",
          "beReadyToAnswer": "string (optional - questions to prepare for)",
          "order": 0,
          "resourceLinks": [{"label": "string", "url": "string", "description": "string"}],
          "checklist": [{"id": "string", "text": "string"}]
        }
      ]
    }
  ]
}

Create a structured, practical program with 2-4 phases and 2-5 modules per phase. Each module should have realistic client stories, clear assignments, and useful checklists. Use progressive complexity. Return ONLY valid JSON, no markdown or code fences.`;

    const userPrompt = `Generate a training program based on this description:\n\n${prompt}`;

    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        temperature: 0.4,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const responseText = message.content[0].type === "text" ? message.content[0].text : "";

      const cleanedResponse = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const result = JSON.parse(cleanedResponse);

      if (!result.program || !result.phases || !Array.isArray(result.phases)) {
        throw new Error("Invalid structure: missing program or phases array");
      }

      return {
        program: result.program,
        phases: result.phases,
      };
    } catch (error) {
      console.error("Failed to generate training program:", error);
      throw new Error("Failed to generate training program. Please try again with a clearer description.");
    }
  }
}

export const aiService = new AIService();
