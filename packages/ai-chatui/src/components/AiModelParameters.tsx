import {FC, useRef} from 'react';
import {Sliders, Wrench, FileText, Upload, Eye} from 'lucide-react';
import {useStoreWithAiChatUi} from '../AiConfigSlice';
import {
  Textarea,
  Input,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  useDisclosure,
  useToast,
} from '@sqlrooms/ui';
import {useBaseRoomShellStore} from '@sqlrooms/room-shell';
import {getDefaultInstructions} from '@sqlrooms/ai';

export const AiModelParameters: FC = () => {
  const maxSteps = useStoreWithAiChatUi(
    (s) => s.getAiConfig().modelParameters.maxSteps,
  );
  const systemInstruction = useStoreWithAiChatUi(
    (s) => s.getAiConfig().modelParameters.systemInstruction,
  );
  const setMaxSteps = useStoreWithAiChatUi((s) => s.setMaxSteps);
  const setSystemInstruction = useStoreWithAiChatUi(
    (s) => s.setSystemInstruction,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {toast} = useToast();

  // Get tables schema from room store
  const tables = useBaseRoomShellStore((s) => s.db.tables);

  const {isOpen, onOpen, onClose} = useDisclosure();

  const handleMaxStepsChange = (value: number) => {
    setMaxSteps(value);
  };

  const handleSystemInstructionChange = (value: string) => {
    setSystemInstruction(value);
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['text/plain', 'text/markdown', 'application/json'];
    const allowedExtensions = ['.txt', '.md', '.json', '.text'];
    const fileExtension = file.name
      .toLowerCase()
      .slice(file.name.lastIndexOf('.'));

    if (
      !allowedTypes.includes(file.type) &&
      !allowedExtensions.includes(fileExtension)
    ) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a text file (.txt, .md, .json)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 1MB)
    const maxSize = 1024 * 1024; // 1MB
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'File size must be less than 1MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      const text = await file.text();
      setSystemInstruction(text);
      toast({
        title: 'File uploaded successfully',
        description:
          'System instructions have been updated from the uploaded file.',
      });
    } catch (error) {
      console.error('Error reading file:', error);
      toast({
        title: 'Error reading file',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleViewFullInstructions = () => {
    onOpen();
  };

  // Compute full instructions on-the-fly
  const getFullInstructions = () => {
    const defaultInstructions = getDefaultInstructions(tables);
    const additionalInstructions = systemInstruction;

    if (additionalInstructions) {
      return `${defaultInstructions}\n\nAdditional Instructions:\n\n${additionalInstructions}`;
    } else {
      return `${defaultInstructions}.`;
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-md flex items-center gap-2 pb-6 font-medium">
        <Sliders className="h-4 w-4" />
        Model Parameters
      </label>
      <div className="grid grid-cols-1 gap-4">
        {/* Max Steps */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Wrench className="h-4 w-4" />
            Max Tool Steps
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              max="20"
              step="1"
              value={maxSteps}
              onChange={(e) =>
                handleMaxStepsChange(parseInt(e.target.value) || 1)
              }
              className="flex-1"
            />
          </div>
        </div>

        {/* System Instruction */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            Additional Instructions
          </label>
          <Textarea
            value={systemInstruction}
            onChange={(e) => handleSystemInstructionChange(e.target.value)}
            placeholder="Enter custom system instructions for the AI model..."
            className="min-h-[80px] resize-y"
            autoResize={false}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUploadButtonClick}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload File
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewFullInstructions}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              View Instructions
            </Button>
          </div>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.json,.text,text/plain,text/markdown,application/json"
            onChange={handleFileUpload}
            style={{display: 'none'}}
          />
        </div>
      </div>

      {/* Full Instructions Modal */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="flex h-[80vh] max-w-4xl flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Full System Instructions</DialogTitle>
            <DialogDescription>
              Complete system instructions that will be sent to the AI model,
              including default instructions and your additional custom
              instructions.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 min-h-0 flex-1 overflow-hidden">
            <div className="bg-muted/50 h-full overflow-auto rounded-lg p-4">
              <pre className="overflow-wrap-anywhere w-full max-w-full break-words font-mono text-sm leading-relaxed">
                {getFullInstructions()}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
