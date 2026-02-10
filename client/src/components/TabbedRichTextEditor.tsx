import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { RichTextEditor } from './RichTextEditor';
import { Button } from '@/components/ui/button';
import { Plus, X, Edit2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { AccountNote } from '@shared/schema';

interface TabbedRichTextEditorProps {
  accountId: string;
}

export function TabbedRichTextEditor({ accountId }: TabbedRichTextEditorProps) {
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [renameTabId, setRenameTabId] = useState<string | null>(null);
  const [renameTabName, setRenameTabName] = useState('');
  const savingNotesRef = useRef<Set<string>>(new Set());
  const pendingContentRef = useRef<Map<string, string>>(new Map());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notes = [], isLoading } = useQuery<AccountNote[]>({
    queryKey: ['/api/accounts', accountId, 'notes'],
    queryFn: async () => {
      const response = await fetch(`/api/accounts/${accountId}/notes`);
      if (!response.ok) throw new Error('Failed to fetch notes');
      return response.json();
    },
  });

  useEffect(() => {
    if (notes.length > 0 && !activeTabId) {
      setActiveTabId(notes[0].id);
    }
  }, [notes, activeTabId]);

  const createNoteMutation = useMutation({
    mutationFn: async (name: string): Promise<AccountNote> => {
      const maxOrder = notes.length > 0 ? Math.max(...notes.map(n => n.order)) : -1;
      return apiRequest(`/api/accounts/${accountId}/notes`, 'POST', {
        name,
        content: '',
        order: maxOrder + 1,
      });
    },
    onSuccess: (newNote: AccountNote) => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts', accountId, 'notes'] });
      setActiveTabId(newNote.id);
      setShowCreateDialog(false);
      setNewTabName('');
      toast({ title: 'Note created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create note', variant: 'destructive' });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      return apiRequest(`/api/accounts/${accountId}/notes/${id}`, 'PATCH', { content });
    },
  });

  const renameNoteMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest(`/api/accounts/${accountId}/notes/${id}`, 'PATCH', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts', accountId, 'notes'] });
      setShowRenameDialog(false);
      setRenameTabId(null);
      setRenameTabName('');
      toast({ title: 'Note renamed successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to rename note', variant: 'destructive' });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/accounts/${accountId}/notes/${id}`, 'DELETE');
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts', accountId, 'notes'] });
      if (activeTabId === deletedId && notes.length > 1) {
        const currentIndex = notes.findIndex(n => n.id === deletedId);
        const nextNote = notes[currentIndex + 1] || notes[currentIndex - 1];
        setActiveTabId(nextNote?.id || null);
      }
      toast({ title: 'Note deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete note', variant: 'destructive' });
    },
  });

  const handleContentChange = async (noteId: string, content: string) => {
    if (savingNotesRef.current.has(noteId)) {
      pendingContentRef.current.set(noteId, content);
      return;
    }
    
    savingNotesRef.current.add(noteId);
    try {
      await updateNoteMutation.mutateAsync({ id: noteId, content });
    } finally {
      savingNotesRef.current.delete(noteId);
      
      if (pendingContentRef.current.has(noteId)) {
        const pending = pendingContentRef.current.get(noteId)!;
        pendingContentRef.current.delete(noteId);
        handleContentChange(noteId, pending);
      }
    }
  };

  const flushPendingContent = async () => {
    // Wait for all in-flight saves to complete (check live set, not snapshot)
    await new Promise<void>(resolve => {
      const checkInterval = setInterval(() => {
        if (savingNotesRef.current.size === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
      
      // If already empty, resolve immediately
      if (savingNotesRef.current.size === 0) {
        clearInterval(checkInterval);
        resolve();
      }
    });

    // Now that all saves are done, process any pending content
    const pendingUpdates = Array.from(pendingContentRef.current.entries());
    for (const [noteId, content] of pendingUpdates) {
      pendingContentRef.current.delete(noteId);
      await handleContentChange(noteId, content);
    }
  };

  const handleCreateNote = () => {
    if (newTabName.trim()) {
      createNoteMutation.mutate(newTabName.trim());
    }
  };

  const handleRenameNote = () => {
    if (renameTabName.trim() && renameTabId) {
      renameNoteMutation.mutate({ id: renameTabId, name: renameTabName.trim() });
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (notes.length <= 1) {
      toast({ title: 'Cannot delete the last note', variant: 'destructive' });
      return;
    }
    
    // Flush any pending changes before deleting
    await flushPendingContent();
    
    if (window.confirm('Are you sure you want to delete this note?')) {
      deleteNoteMutation.mutate(id);
    }
  };

  const handleTabChange = async (tabId: string) => {
    // Flush any pending changes before switching tabs
    await flushPendingContent();
    setActiveTabId(tabId);
  };

  const activeNote = notes.find(n => n.id === activeTabId);

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading notes...</div>;
  }

  if (notes.length === 0) {
    return (
      <div className="border rounded-md p-6 text-center">
        <p className="text-muted-foreground mb-4">No notes yet</p>
        <Button
          onClick={() => setShowCreateDialog(true)}
          size="sm"
          data-testid="button-create-first-note"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Note
        </Button>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Note</DialogTitle>
            </DialogHeader>
            <Input
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              placeholder="Note name"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateNote()}
              data-testid="input-note-name"
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateNote} data-testid="button-confirm-create">
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {notes.map((note) => (
          <div
            key={note.id}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md border transition-colors ${
              activeTabId === note.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover-elevate cursor-pointer'
            }`}
          >
            <button
              onClick={() => handleTabChange(note.id)}
              className="font-medium text-sm"
              data-testid={`tab-${note.id}`}
            >
              {note.name}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRenameTabId(note.id);
                setRenameTabName(note.name);
                setShowRenameDialog(true);
              }}
              className="p-1 rounded hover-elevate"
              data-testid={`button-rename-${note.id}`}
            >
              <Edit2 className="h-3 w-3" />
            </button>
            {notes.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteNote(note.id);
                }}
                className="p-1 rounded hover-elevate"
                data-testid={`button-delete-${note.id}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        <Button
          onClick={() => setShowCreateDialog(true)}
          variant="outline"
          size="sm"
          className="h-auto py-1.5"
          data-testid="button-create-note"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {activeNote && (
        <RichTextEditor
          key={activeNote.id}
          content={activeNote.content || ''}
          onChange={(content) => handleContentChange(activeNote.id, content)}
          placeholder="Add notes, context, or documentation..."
        />
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Note</DialogTitle>
          </DialogHeader>
          <Input
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            placeholder="Note name"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateNote()}
            data-testid="input-note-name"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNote} data-testid="button-confirm-create">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Note</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTabName}
            onChange={(e) => setRenameTabName(e.target.value)}
            placeholder="Note name"
            onKeyDown={(e) => e.key === 'Enter' && handleRenameNote()}
            data-testid="input-rename-note"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameNote} data-testid="button-confirm-rename">
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
