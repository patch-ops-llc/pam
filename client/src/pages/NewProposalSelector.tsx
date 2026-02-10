import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, PenTool, FileText } from "lucide-react";

export default function NewProposalSelector() {
  const [, navigate] = useLocation();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/proposals")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Create New Proposal
          </h1>
          <p className="text-muted-foreground">
            Choose how you'd like to create your proposal
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 max-w-6xl">
        <Card 
          className="hover-elevate cursor-pointer transition-all"
          onClick={() => navigate("/proposals/create/transcript")}
          data-testid="card-transcript-option"
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>From Chat Transcript</CardTitle>
                <CardDescription>AI generates scope from conversations</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Paste your client conversation and let AI analyze it to generate a structured scope of work with hour estimates, workstreams, and deliverables.
            </p>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Auto-extracts project requirements
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Generates structured scope items
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Includes hour estimates and assumptions
              </li>
            </ul>
            <Button className="mt-6 w-full" data-testid="button-start-transcript">
              Start with Transcript
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="hover-elevate cursor-pointer transition-all"
          onClick={() => navigate("/proposals/create/document")}
          data-testid="card-document-option"
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-secondary/20">
                <FileText className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <CardTitle>From Document</CardTitle>
                <CardDescription>Upload or paste existing content</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Import an existing document (PDF, Word, or text) and AI will convert it into a beautifully formatted proposal with your branding applied.
            </p>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary-foreground" />
                Supports PDF, DOCX, and plain text
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary-foreground" />
                Auto-applies your branding
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary-foreground" />
                Opens in visual editor for tweaks
              </li>
            </ul>
            <Button variant="secondary" className="mt-6 w-full" data-testid="button-start-document">
              Start with Document
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="hover-elevate cursor-pointer transition-all"
          onClick={() => navigate("/proposals/create/visual")}
          data-testid="card-visual-option"
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-accent/10">
                <PenTool className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <CardTitle>Visual Editor</CardTitle>
                <CardDescription>Freeform editing with AI copilot</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Create proposals in a visual editor with full formatting control. Use the AI copilot for assistance with writing, expanding ideas, and refining content.
            </p>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-foreground" />
                Rich text formatting and styling
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-foreground" />
                AI copilot for content suggestions
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-foreground" />
                Full creative control over layout
              </li>
            </ul>
            <Button variant="outline" className="mt-6 w-full" data-testid="button-start-visual">
              Start with Visual Editor
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
