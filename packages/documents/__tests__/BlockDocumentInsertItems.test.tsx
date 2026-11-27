/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals';
import type {Editor} from '@tiptap/react';
import {ImageIcon, SparklesIcon} from 'lucide-react';
import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import type {BlockDocumentContent} from '../src/BlockDocumentSliceConfig';
import type {BlockDocumentInsertItem} from '../src/BlockDocumentEditor/BlockDocumentInsertItems';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.unstable_mockModule('../src/block-settings/useBlockSettingsStore', () => ({
  useBlockSettingsStore: () => undefined,
}));

const {BlockDocumentEditor} = await import('../src/BlockDocumentEditor');
const {createDefaultBlockDocumentInsertItems} =
  await import('../src/BlockDocumentEditor/BlockDocumentInsertItems');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

function calloutItem(
  createNode: BlockDocumentInsertItem['createNode'],
): BlockDocumentInsertItem {
  return {
    id: 'callout',
    group: 'insert',
    label: 'Callout',
    description: 'Highlighted note',
    icon: SparklesIcon,
    createNode,
  };
}

const imageItem: BlockDocumentInsertItem = {
  id: 'image',
  group: 'insert',
  label: 'Image',
  description: 'Upload an image',
  icon: ImageIcon,
  createNode: (id) => ({
    type: 'blockDocumentImage',
    attrs: {id, assetId: 'asset-1', caption: ''},
  }),
};

function slashDocument(): BlockDocumentContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: {id: 'slash-block'},
        content: [{type: 'text', text: '/'}],
      },
    ],
  };
}

type Mounted = {
  container: HTMLElement;
  editor: Editor;
  root: Root;
};

let mounted: Mounted | null = null;

async function mountEditor({
  insertItems,
  value = slashDocument(),
  toolbar = false,
}: {
  insertItems?: BlockDocumentInsertItem[];
  value?: BlockDocumentContent;
  toolbar?: boolean | ReactNode;
}): Promise<Mounted> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let editor: Editor | null = null;
  await act(async () => {
    root.render(
      <BlockDocumentEditor
        documentId="document-1"
        value={value}
        onChange={() => {}}
        insertItems={insertItems}
        onEditorReady={(readyEditor) => {
          editor = readyEditor;
        }}
      >
        {toolbar === true ? <BlockDocumentEditor.Toolbar /> : toolbar || null}
        <BlockDocumentEditor.Content />
      </BlockDocumentEditor>,
    );
  });
  if (!editor) throw new Error('Editor was not created');
  mounted = {container, editor, root};
  return mounted;
}

/** Puts the caret after the slash so the slash search opens. */
async function openSlashSearch(editor: Editor) {
  // jsdom does not focus contenteditable elements; mark the editor focused.
  editor.isFocused = true;
  await act(async () => {
    // Title node first, then the paragraph holding '/'.
    let slashEnd = 0;
    editor.state.doc.forEach((node, offset) => {
      if (node.attrs.id === 'slash-block') slashEnd = offset + 2;
    });
    editor.commands.setTextSelection(slashEnd);
  });
}

function pressEnter(editor: Editor) {
  act(() => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

function topLevelBlocks(editor: Editor) {
  const blocks: {type: string; id: unknown; text: string}[] = [];
  editor.state.doc.forEach((node) => {
    blocks.push({
      type: node.type.name,
      id: node.attrs.id,
      text: node.textContent,
    });
  });
  return blocks.slice(1); // drop the title node
}

function slashMenuLabels() {
  return Array.from(
    document.body.querySelectorAll('[data-block-type-search-item]'),
  ).map((element) => element.textContent);
}

afterEach(() => {
  if (!mounted) return;
  const {root, container} = mounted;
  act(() => root.unmount());
  container.remove();
  mounted = null;
  jest.restoreAllMocks();
});

describe('createDefaultBlockDocumentInsertItems', () => {
  it('lists the built-in items with stable ids and no Image item', () => {
    const items = createDefaultBlockDocumentInsertItems();
    expect(items.map((item) => [item.id, item.group])).toEqual([
      ['paragraph', 'text'],
      ['heading-1', 'text'],
      ['heading-2', 'text'],
      ['heading-3', 'text'],
      ['bulleted-list', 'text'],
      ['numbered-list', 'text'],
      ['todo', 'text'],
      ['quote', 'text'],
      ['code', 'text'],
      ['divider', 'insert'],
      ['chart', 'insert'],
    ]);
    expect(items.some((item) => item.label === 'Image')).toBe(false);
  });
});

describe('BlockDocumentEditor insertItems', () => {
  it('shows the default items in the slash search', async () => {
    const {editor} = await mountEditor({});
    await openSlashSearch(editor);
    const labels = slashMenuLabels();
    expect(labels).toContain('Heading 1');
    expect(labels).toContain('Chart');
    expect(labels).not.toContain('Image');
  });

  it('lets a custom list control the slash search', async () => {
    const items = [
      ...createDefaultBlockDocumentInsertItems().filter(
        (item) => item.id === 'paragraph',
      ),
      imageItem,
    ];
    const {editor} = await mountEditor({insertItems: items});
    await openSlashSearch(editor);
    expect(slashMenuLabels()).toEqual(['Paragraph', 'Image']);
  });

  it('lets a custom list control the block menu', async () => {
    const items = [
      ...createDefaultBlockDocumentInsertItems().filter(
        (item) => item.id === 'heading-1',
      ),
      imageItem,
    ];
    const {container, editor} = await mountEditor({
      insertItems: items,
      value: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: {id: 'block-1'},
            content: [{type: 'text', text: 'Hello'}],
          },
        ],
      },
    });
    const blockElement = editor.view.dom.querySelector(
      '[data-block-document-block-id="block-1"]',
    )!;
    act(() => {
      blockElement.dispatchEvent(new MouseEvent('mousemove', {bubbles: true}));
    });
    const handle = container.querySelector<HTMLElement>(
      '[aria-label="Block options"]',
    )!;
    act(() => handle.click());
    const turnInto = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((element) => element.textContent === 'Turn into')!;
    act(() => {
      turnInto.focus();
      turnInto.dispatchEvent(
        new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}),
      );
    });
    const menuItems = Array.from(
      document.body.querySelectorAll('[role="menuitem"]'),
    ).map((element) => element.textContent);
    expect(menuItems).toContain('Image');
    expect(menuItems).toContain('Text');
    expect(menuItems).not.toContain('Divider');
    expect(menuItems).not.toContain('Chart');
  });

  it('inserts an async block once createNode resolves', async () => {
    const pending = deferred<Record<string, unknown> | null>();
    const createNode = jest.fn(() => pending.promise);
    const {editor} = await mountEditor({
      insertItems: [calloutItem(createNode)],
    });
    await openSlashSearch(editor);

    pressEnter(editor);
    expect(createNode).toHaveBeenCalledWith('slash-block', {initialText: ''});
    // The search closes right away, and the document is unchanged meanwhile.
    expect(slashMenuLabels()).toEqual([]);
    expect(topLevelBlocks(editor)).toEqual([
      {type: 'paragraph', id: 'slash-block', text: '/'},
    ]);

    await act(async () => {
      pending.resolve({type: 'horizontalRule', attrs: {id: 'slash-block'}});
      await pending.promise;
    });
    expect(topLevelBlocks(editor)[0]).toEqual({
      type: 'horizontalRule',
      id: 'slash-block',
      text: '',
    });
    expect(createNode).toHaveBeenCalledTimes(1);
  });

  it('leaves the document unchanged when createNode resolves to null', async () => {
    const pending = deferred<Record<string, unknown> | null>();
    const {editor} = await mountEditor({
      insertItems: [calloutItem(() => pending.promise)],
    });
    await openSlashSearch(editor);

    pressEnter(editor);
    await act(async () => {
      pending.resolve(null);
      await pending.promise;
    });
    expect(topLevelBlocks(editor)).toEqual([
      {type: 'paragraph', id: 'slash-block', text: '/'},
    ]);
  });

  it('leaves the document unchanged and logs when createNode rejects', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const pending = deferred<Record<string, unknown> | null>();
    const {editor} = await mountEditor({
      insertItems: [calloutItem(() => pending.promise)],
    });
    await openSlashSearch(editor);

    pressEnter(editor);
    await act(async () => {
      pending.reject(new Error('upload failed'));
      await pending.promise.catch(() => {});
    });
    expect(topLevelBlocks(editor)).toEqual([
      {type: 'paragraph', id: 'slash-block', text: '/'},
    ]);
    expect(error).toHaveBeenCalled();
  });

  it('does nothing if the target block is deleted while pending', async () => {
    const pending = deferred<Record<string, unknown> | null>();
    const {editor} = await mountEditor({
      insertItems: [calloutItem(() => pending.promise)],
    });
    await openSlashSearch(editor);

    pressEnter(editor);
    await act(async () => {
      let from = 0;
      let to = 0;
      editor.state.doc.forEach((node, offset) => {
        if (node.attrs.id === 'slash-block') {
          from = offset;
          to = offset + node.nodeSize;
        }
      });
      editor.view.dispatch(
        editor.state.tr.replaceWith(
          from,
          to,
          editor.schema.nodes.paragraph!.create(
            {id: 'other-block'},
            editor.schema.text('Other'),
          ),
        ),
      );
    });
    await act(async () => {
      pending.resolve({type: 'horizontalRule', attrs: {id: 'slash-block'}});
      await pending.promise;
    });
    expect(topLevelBlocks(editor)).toEqual([
      {type: 'paragraph', id: 'other-block', text: 'Other'},
    ]);
  });
});

describe('BlockDocumentEditor.Toolbar', () => {
  function toolbarLabels(container: HTMLElement) {
    return Array.from(container.querySelectorAll('button[aria-label]'))
      .map((button) => button.getAttribute('aria-label'))
      .filter((label) => label?.startsWith('Insert '));
  }

  it('leaves out Image unless an image item is provided', async () => {
    const {container} = await mountEditor({toolbar: true});
    expect(toolbarLabels(container)).toEqual([
      'Insert paragraph',
      'Insert chart',
    ]);
  });

  it('shows Image when the host provides an image item', async () => {
    const {container, editor} = await mountEditor({
      toolbar: true,
      insertItems: [...createDefaultBlockDocumentInsertItems(), imageItem],
    });
    expect(toolbarLabels(container)).toEqual([
      'Insert paragraph',
      'Insert image',
      'Insert chart',
    ]);

    const button = container.querySelector<HTMLElement>(
      '[aria-label="Insert image"]',
    )!;
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    });
    act(() => button.click());
    expect(
      topLevelBlocks(editor).some(
        (block) => block.type === 'blockDocumentImage',
      ),
    ).toBe(true);
  });

  it('ignores repeat clicks while an async item is pending', async () => {
    const pending = deferred<Record<string, unknown> | null>();
    const createNode = jest.fn(() => pending.promise);
    const {container} = await mountEditor({
      toolbar: true,
      insertItems: [{...calloutItem(createNode), id: 'chart'}],
    });
    const button = container.querySelector<HTMLElement>(
      '[aria-label="Insert callout"]',
    )!;
    act(() => button.click());
    act(() => button.click());
    expect(createNode).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve(null);
      await pending.promise;
    });
    await act(async () => button.click());
    expect(createNode).toHaveBeenCalledTimes(2);
  });

  it('renders composed children in the given order', async () => {
    const {container} = await mountEditor({
      insertItems: [...createDefaultBlockDocumentInsertItems(), imageItem],
      toolbar: (
        <BlockDocumentEditor.Toolbar>
          <BlockDocumentEditor.Toolbar.InsertButton itemId="chart" />
          <span data-testid="host">Host</span>
          <BlockDocumentEditor.Toolbar.InsertButton itemId="image" />
        </BlockDocumentEditor.Toolbar>
      ),
    });
    const toolbar = container.querySelector('[role="toolbar"]')!;
    expect(
      Array.from(toolbar.children).map(
        (child) =>
          child.getAttribute('aria-label') ?? child.getAttribute('data-testid'),
      ),
    ).toEqual(['Insert chart', 'host', 'Insert image']);
    // No formatting controls or default insert buttons.
    expect(container.querySelector('[aria-label="Insert paragraph"]')).toBe(
      null,
    );
  });

  it('renders nothing for an unknown InsertButton id', async () => {
    const {container} = await mountEditor({
      toolbar: (
        <BlockDocumentEditor.Toolbar>
          <BlockDocumentEditor.Toolbar.InsertButton itemId="missing" />
        </BlockDocumentEditor.Toolbar>
      ),
    });
    const toolbar = container.querySelector('[role="toolbar"]');
    expect(toolbar).not.toBe(null);
    expect(toolbar!.childElementCount).toBe(0);
    expect(toolbarLabels(container)).toEqual([]);
  });

  describe('InsertButton with an async createNode', () => {
    async function mountCalloutButton(
      createNode: BlockDocumentInsertItem['createNode'],
    ) {
      const result = await mountEditor({
        insertItems: [calloutItem(createNode)],
        toolbar: (
          <BlockDocumentEditor.Toolbar>
            <BlockDocumentEditor.Toolbar.InsertButton itemId="callout" />
          </BlockDocumentEditor.Toolbar>
        ),
      });
      act(() => {
        result.editor.commands.setTextSelection(
          result.editor.state.doc.content.size - 1,
        );
      });
      const button = result.container.querySelector<HTMLButtonElement>(
        '[aria-label="Insert callout"]',
      )!;
      return {...result, button};
    }

    it('inserts the block once the promise resolves', async () => {
      const pending = deferred<Record<string, unknown> | null>();
      const {editor, button} = await mountCalloutButton(() => pending.promise);
      const before = topLevelBlocks(editor).length;

      act(() => button.click());
      expect(button.disabled).toBe(true);
      expect(topLevelBlocks(editor)).toHaveLength(before);

      await act(async () => {
        pending.resolve({type: 'horizontalRule', attrs: {id: 'callout-1'}});
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(topLevelBlocks(editor).map((block) => block.id)).toContain(
        'callout-1',
      );
      expect(button.disabled).toBe(false);
    });

    it('inserts nothing when the promise resolves to null', async () => {
      const pending = deferred<Record<string, unknown> | null>();
      const {editor, button} = await mountCalloutButton(() => pending.promise);
      const before = JSON.stringify(editor.getJSON());

      act(() => button.click());
      await act(async () => {
        pending.resolve(null);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(JSON.stringify(editor.getJSON())).toBe(before);
      expect(button.disabled).toBe(false);
    });
  });
});
