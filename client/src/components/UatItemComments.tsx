import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Send, Reply, User, Users, Shield, Pencil, X, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Comment {
  id: string;
  itemId: string;
  parentId: string | null;
  authorType: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface UatItemCommentsProps {
  itemId: string;
  itemTitle?: string;
  apiEndpoint: string;
  currentUserName: string;
  currentUserId?: string;
  readOnly?: boolean;
}

export function UatItemComments({ 
  itemId, 
  itemTitle,
  apiEndpoint, 
  currentUserName,
  currentUserId,
  readOnly = false
}: UatItemCommentsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const { data: comments = [], isLoading, error } = useQuery<Comment[]>({
    queryKey: [apiEndpoint, itemId, "comments"],
    queryFn: async () => {
      const res = await fetch(`${apiEndpoint}/${itemId}/comments`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({ body, parentId }: { body: string; parentId?: string }) => {
      const res = await apiRequest(`${apiEndpoint}/${itemId}/comments`, "POST", { body, parentId });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to post comment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint, itemId, "comments"] });
      setNewComment("");
      setReplyText("");
      setReplyingTo(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to post comment", description: error.message, variant: "destructive" });
    },
  });

  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, body }: { commentId: string; body: string }) => {
      const editEndpoint = apiEndpoint.includes("/token/") 
        ? apiEndpoint.replace(/\/items$/, "/comments")
        : apiEndpoint.includes("/pm/")
        ? apiEndpoint.replace(/\/items$/, "/comments")
        : "/api/uat-comments";
      const res = await apiRequest(`${editEndpoint}/${commentId}`, "PATCH", { body });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update comment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint, itemId, "comments"] });
      setEditingId(null);
      setEditText("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update comment", description: error.message, variant: "destructive" });
    },
  });

  const getAuthorIcon = (authorType: string) => {
    switch (authorType) {
      case "internal":
        return <Shield className="w-3 h-3" />;
      case "pm_collaborator":
        return <Users className="w-3 h-3" />;
      case "guest":
      default:
        return <User className="w-3 h-3" />;
    }
  };

  const getAuthorLabel = (authorType: string) => {
    switch (authorType) {
      case "internal":
        return "Dev";
      case "pm_collaborator":
        return "PM";
      case "guest":
      default:
        return "Tester";
    }
  };

  const getAuthorColor = (authorType: string) => {
    switch (authorType) {
      case "internal":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "pm_collaborator":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
      case "guest":
      default:
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    }
  };

  const canEditComment = (comment: Comment) => {
    if (readOnly) return false;
    if (!currentUserId) return false;
    return comment.authorId === currentUserId;
  };

  const startEditing = (comment: Comment) => {
    setEditingId(comment.id);
    setEditText(comment.body);
    setReplyingTo(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText("");
  };

  const topLevelComments = comments.filter(c => !c.parentId);
  const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId);

  const renderComment = (comment: Comment, isReply = false) => {
    const replies = getReplies(comment.id);
    const isEditing = editingId === comment.id;
    
    return (
      <div key={comment.id} className={`${isReply ? "ml-8 mt-2" : "mt-3"}`}>
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className={getAuthorColor(comment.authorType)}>
              {comment.authorName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{comment.authorName}</span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${getAuthorColor(comment.authorType)}`}>
                {getAuthorIcon(comment.authorType)}
                {getAuthorLabel(comment.authorType)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              </span>
              {comment.updatedAt !== comment.createdAt && (
                <span className="text-xs text-muted-foreground italic">(edited)</span>
              )}
            </div>
            
            {isEditing ? (
              <div className="mt-2 flex gap-2">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[60px] text-sm"
                  autoFocus
                />
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    onClick={() => editCommentMutation.mutate({ commentId: comment.id, body: editText })}
                    disabled={!editText.trim() || editCommentMutation.isPending}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelEditing}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm mt-1 whitespace-pre-wrap">{comment.body}</p>
                <div className="flex gap-1 mt-1">
                  {!readOnly && !isReply && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-xs"
                      onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                    >
                      <Reply className="w-3 h-3 mr-1" />
                      Reply
                    </Button>
                  )}
                  {canEditComment(comment) && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-xs"
                      onClick={() => startEditing(comment)}
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              </>
            )}
            
            {replyingTo === comment.id && !isEditing && (
              <div className="mt-2 flex gap-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="min-h-[60px] text-sm"
                />
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    onClick={() => createCommentMutation.mutate({ body: replyText, parentId: comment.id })}
                    disabled={!replyText.trim() || createCommentMutation.isPending}
                  >
                    <Send className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setReplyingTo(null); setReplyText(""); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {replies.map(reply => renderComment(reply, true))}
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4" />
          <h4 className="font-medium text-sm">
            Discussion{itemTitle ? `: ${itemTitle}` : ""}
          </h4>
          <span className="text-xs text-muted-foreground">({comments.length})</span>
        </div>

        {!readOnly && (
          <div className="flex gap-2 mb-4">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="min-h-[60px] text-sm"
            />
            <Button
              onClick={() => createCommentMutation.mutate({ body: newComment })}
              disabled={!newComment.trim() || createCommentMutation.isPending}
              size="sm"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-4 text-sm text-muted-foreground">Loading comments...</div>
        ) : error ? (
          <div className="text-center py-4 text-sm text-destructive">
            Failed to load comments. Please try again.
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No comments yet. {!readOnly && "Start the conversation!"}
          </div>
        ) : (
          <div className="space-y-1">
            {topLevelComments.map(comment => renderComment(comment))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
