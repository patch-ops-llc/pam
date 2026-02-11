import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TrainingModuleSubmission, TrainingModule, TrainingEnrollment, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  User as UserIcon,
  BookOpen,
  Clock,
  MessageSquare,
  Send,
} from "lucide-react";

type ReviewItem = TrainingModuleSubmission & {
  module: TrainingModule;
  enrollment: TrainingEnrollment;
  user: User;
};

export default function TrainingReview() {
  const { toast } = useToast();
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: reviews, isLoading } = useQuery<ReviewItem[]>({
    queryKey: ["/api/training/reviews"],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ submissionId, status, reviewerNotes, reviewerRating }: {
      submissionId: string;
      status: string;
      reviewerNotes: string;
      reviewerRating: string;
    }) => {
      const response = await apiRequest(`/api/training/reviews/${submissionId}`, "PATCH", {
        status,
        reviewerNotes,
        reviewerRating,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/reviews"] });
      setSelectedReview(null);
      setReviewNotes("");
      toast({ title: "Review submitted", description: "The trainee has been notified." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function handleReview(status: "passed" | "needs_revision") {
    if (!selectedReview) return;
    reviewMutation.mutate({
      submissionId: selectedReview.id,
      status,
      reviewerNotes: reviewNotes,
      reviewerRating: status,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 training-ui">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8" />
          Training Reviews
        </h1>
        <p className="text-muted-foreground mt-1 text-base">
          Review and provide feedback on trainee module submissions
        </p>
      </div>

      {(!reviews || reviews.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-base font-medium">No Pending Reviews</h3>
            <p className="text-muted-foreground mt-1">
              All submissions have been reviewed. Check back later for new submissions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card
              key={review.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setSelectedReview(review);
                setReviewNotes("");
              }}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="text-base font-semibold">{review.module.title}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        {review.user.firstName} {review.user.lastName}
                      </span>
                      {review.submittedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Submitted {new Date(review.submittedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {review.submissionNotes && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {review.submissionNotes}
                      </p>
                    )}
                  </div>
                  <Badge variant={review.status === "submitted" ? "default" : "secondary"}>
                    {review.status === "submitted" ? "Awaiting Review" : "Under Review"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={selectedReview !== null} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedReview && (
            <>
              <DialogHeader>
                <DialogTitle>Review: {selectedReview.module.title}</DialogTitle>
                <DialogDescription>
                  Submission by {selectedReview.user.firstName} {selectedReview.user.lastName}
                  {selectedReview.submittedAt && (
                    <> on {new Date(selectedReview.submittedAt).toLocaleDateString()}</>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Trainee's Submission Notes */}
                {selectedReview.submissionNotes && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Trainee's Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm whitespace-pre-wrap">
                        {selectedReview.submissionNotes}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Module Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Module Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    {selectedReview.module.estimatedHours && (
                      <p><strong>Estimated hours:</strong> {selectedReview.module.estimatedHours}</p>
                    )}
                    {selectedReview.module.clientStory && (
                      <details className="cursor-pointer">
                        <summary className="font-medium">Client Story</summary>
                        <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{selectedReview.module.clientStory.substring(0, 500)}...</p>
                      </details>
                    )}
                  </CardContent>
                </Card>

                {/* Reviewer Feedback */}
                <div className="space-y-2">
                  <Label>Your Feedback</Label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Provide detailed feedback on the trainee's work, including strengths, areas for improvement, and specific things to address if revisions are needed..."
                    rows={6}
                  />
                </div>
              </div>

              <DialogFooter className="flex gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setSelectedReview(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleReview("needs_revision")}
                  disabled={reviewMutation.isPending || !reviewNotes.trim()}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Needs Revision
                </Button>
                <Button
                  onClick={() => handleReview("passed")}
                  disabled={reviewMutation.isPending || !reviewNotes.trim()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Pass
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
