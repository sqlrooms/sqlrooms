import type {ToolRendererProps} from '@sqlrooms/ai';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@sqlrooms/ui';
import {ImageIcon} from 'lucide-react';
import {useStore} from 'zustand';
import {
  createRenderedSurfaceAiTools,
  type CreateRenderedSurfaceAiToolsOptions,
  type RenderedSurfaceImageToolOutput,
} from './createRenderedSurfaceAiTools';
import {createRenderedSurfaceImageStore} from './renderedSurfaceImageStore';

/** Creates capture tools and previews backed by the same ephemeral pixels. */
export function createRenderedSurfaceAiToolkit(
  options: CreateRenderedSurfaceAiToolsOptions = {},
) {
  const imageStore = options.imageStore ?? createRenderedSurfaceImageStore();
  const tools = createRenderedSurfaceAiTools({...options, imageStore});

  function CapturedImageResult({
    output,
  }: ToolRendererProps<RenderedSurfaceImageToolOutput>) {
    const captureId = output?.success ? output.captureId : undefined;
    const image = useStore(imageStore, (state) =>
      captureId ? state.images.get(captureId) : undefined,
    );
    if (!output) return null;
    if (!output.success) {
      return <p className="text-destructive text-xs">{output.error}</p>;
    }
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="xs" className="text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5" />
            View captured image
          </Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[90vh] w-[90vw] max-w-5xl flex-col">
          <DialogHeader>
            <DialogTitle>Captured image</DialogTitle>
            <DialogDescription>{output.details}</DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground text-xs">
            {output.width} × {output.height} ·{' '}
            <time dateTime={output.capturedAt}>
              {new Date(output.capturedAt).toLocaleString()}
            </time>
          </p>
          {image ? (
            <div className="min-h-0 overflow-auto rounded border">
              <img
                src={`data:image/png;base64,${image.base64}`}
                alt="Image captured by the rendering tool"
                width={image.width}
                height={image.height}
                className="mx-auto h-auto max-w-full"
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              This capture is no longer available. Images are kept temporarily
              and cleared after a reload or newer captures. Run the rendering
              tool again to capture the current view.
            </p>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return {
    tools,
    toolRenderers: {
      render_artifact_image: CapturedImageResult,
      render_document_block_image: CapturedImageResult,
      render_dashboard_panel_image: CapturedImageResult,
    },
  };
}
