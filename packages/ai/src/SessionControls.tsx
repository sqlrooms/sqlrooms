import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EditableText,
  Input,
} from '@sqlrooms/ui';
import {
  Check,
  ChevronDown,
  History,
  Plus as PlusIcon,
  Trash2,
} from 'lucide-react';
import React, {useState} from 'react';
import {useStoreWithAi} from './AiSlice';

export const SessionControls: React.FC = () => {
  const sessions = useStoreWithAi((s) => s.config.ai.sessions);
  const currentSessionId = useStoreWithAi((s) => s.config.ai.currentSessionId);
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const switchSession = useStoreWithAi((s) => s.ai.switchSession);
  const createSession = useStoreWithAi((s) => s.ai.createSession);
  const renameSession = useStoreWithAi((s) => s.ai.renameSession);
  const deleteSession = useStoreWithAi((s) => s.ai.deleteSession);

  const [newSessionName, setNewSessionName] = useState('');
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(
    null,
  );

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleCreateSession = () => {
    if (newSessionName.trim()) {
      createSession(newSessionName);
      setNewSessionName('');
      setIsCreateDialogOpen(false);
    }
  };

  const handleOpenDeleteDialog = (sessionId: string) => {
    setSessionToDeleteId(sessionId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteSession = () => {
    if (sessionToDeleteId) {
      deleteSession(sessionToDeleteId);
      setIsDeleteDialogOpen(false);
      setSessionToDeleteId(null);
    }
  };

  return (
    <>
      {/* Header with session controls */}
      <div className="flex flex-wrap items-center justify-between">
        {/* Left side - History Button and Editable Session Title */}
        <div className="flex items-center gap-3">
          {/* Sessions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <History className="h-4 w-4" />
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {sessions.map((session) => (
                <DropdownMenuItem
                  key={session.id}
                  className="flex justify-between py-2"
                  onClick={() => switchSession(session.id)}
                >
                  <span className="truncate">{session.name}</span>
                  {session.id === currentSessionId && (
                    <Check className="h-4 w-4 ml-2" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Editable Session Title */}
          {currentSession ? (
            <EditableText
              value={currentSession.name}
              onChange={(newName) => {
                if (currentSession && newName.trim()) {
                  renameSession(currentSession.id, newName);
                }
              }}
              placeholder="Session name"
              className="text-sm font-medium"
              maxWidth={300}
            />
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              No session selected
            </span>
          )}
        </div>

        {/* Right side buttons */}
        <div className="flex items-center gap-2">
          {/* Delete Current Session Button - Only shown for current session */}
          {sessions.length > 1 && currentSessionId && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => handleOpenDeleteDialog(currentSessionId)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          {/* Create New Session Button */}
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <PlusIcon className="h-4 w-4" />
                New Session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Session</DialogTitle>
                <DialogDescription>
                  Enter a name for your new analysis session.
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="Session name"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateSession}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* <div className="p-4">
          <ModelSelector />
        </div> */}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this session? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSession}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
