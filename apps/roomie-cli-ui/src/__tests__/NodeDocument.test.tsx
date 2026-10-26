/** @jest-environment jsdom */
import {beforeEach, expect, it, jest} from '@jest/globals';
import {act, type ReactNode} from 'react';
import {serialize, deserialize} from 'node:v8';
import {createRoot} from 'react-dom/client';
const request = jest.fn<(...args: any[]) => Promise<any>>();
let editor: any;
const Editor = Object.assign(
  (props: any) => {
    editor = props;
    return <div>{props.children}</div>;
  },
  {Toolbar: () => null, Content: () => null},
);
jest.unstable_mockModule('@sqlrooms/documents', () => ({
  BlockDocumentEditor: Editor,
  BlockDocumentContent: {parse: (value: unknown) => value},
  BlockDocumentChartRendererProvider: ({children}: {children: ReactNode}) =>
    children,
  BlockDocumentStatefulBlockRendererProvider: ({
    children,
  }: {
    children: ReactNode;
  }) => children,
}));
jest.unstable_mockModule('@sqlrooms/mosaic', () => ({
  ChartBlockRenderer: () => null,
  DataTableBlockRenderer: () => null,
  MosaicDashboard: () => null,
}));
jest.unstable_mockModule('@sqlrooms/app-runtime', () => ({
  HtmlAppBlock: () => null,
}));
jest.unstable_mockModule('@sqlrooms/ui', () => ({
  Button: (props: any) => <button {...props} />,
}));
jest.unstable_mockModule('../node/client', () => ({hostRequest: request}));
const {NodeDocument} = await import('../node/Document');
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  request.mockReset();
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    structuredClone: (value: unknown) => deserialize(serialize(value)),
  });
});
const content = {
  type: 'doc' as const,
  content: [
    {
      type: 'paragraph',
      attrs: {id: 'p'},
      content: [{type: 'text', text: 'original'}],
    },
  ],
};
async function setup() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const props = {
    id: 'doc',
    workspaceId: 'w',
    revision: 1,
    title: 'Title',
    content,
    onCommitted: jest.fn(),
  };
  const render = async (overrides = {}) =>
    act(async () => root.render(<NodeDocument {...props} {...overrides} />));
  const click = async (text: string) =>
    act(async () => {
      const button = [...host.querySelectorAll('button')].find(
        (b) => b.textContent === text,
      )!;
      expect(button).toBeTruthy();
      button.click();
    });
  await render();
  return {
    host,
    root,
    props,
    render,
    click,
    close: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}
it('saves simultaneous title/content edits exactly and waits for committed delivery before clearing', async () => {
  const ui = await setup();
  try {
    await ui.click('Edit document');
    const next = {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: {id: 'code', language: 'sql'},
          content: [{type: 'text', text: 'SELECT 1;'}],
        },
      ],
    };
    await act(async () => {
      editor.onTitleChange('New title');
      editor.onChange(next);
    });
    let deliver!: (v: any) => void;
    request.mockImplementation(async (path) =>
      path === '/api/commands'
        ? {}
        : new Promise((r) => {
            deliver = r;
          }),
    );
    await ui.click('Save draft');
    expect(request.mock.calls[0]![1]).toMatchObject({
      input: {title: 'New title', content: next},
      commit: {expectedRevision: 1},
    });
    expect(ui.host.textContent).toContain('Saving');
    expect(localStorage.length).toBe(1);
    await act(async () =>
      deliver({content: next, revisions: {doc: 2}, sequence: 2}),
    );
    expect(ui.props.onCommitted).toHaveBeenCalledWith(next, {doc: 2}, 2);
    expect(ui.host.textContent).toContain('Edit document');
    expect(localStorage.length).toBe(0);
  } finally {
    await ui.close();
  }
});
it('uncertain saves survive remount and retry the same operation; deterministic rejection allows repair', async () => {
  let ui = await setup();
  await ui.click('Edit document');
  request.mockRejectedValueOnce(new Error('network disconnected'));
  await ui.click('Save draft');
  const original = request.mock.calls[0]![1];
  expect(ui.host.textContent).toContain('Retry same save');
  await ui.close();
  ui = await setup();
  try {
    expect(editor.readOnly).toBe(true);
    request.mockRejectedValueOnce(
      Object.assign(new Error('invalid node'), {definitive: true}),
    );
    await ui.click('Retry same save');
    expect(request.mock.calls[1]![1]).toEqual(original);
    expect(editor.readOnly).toBe(false);
    expect(ui.host.textContent).toContain('invalid node');
    await ui.render({revision: 2});
    expect(ui.host.textContent).toContain('draft is preserved');
    expect(
      [...ui.host.querySelectorAll('button')].find(
        (b) => b.textContent === 'Save draft',
      )!.disabled,
    ).toBe(true);
  } finally {
    await ui.close();
  }
});
it('independent tabs retain separate drafts in the same workspace', async () => {
  const first = await setup();
  await first.click('Edit document');
  await act(async () => editor.onTitleChange('First tab'));
  await first.close();
  sessionStorage.clear();
  const second = await setup();
  try {
    expect(second.host.textContent).toContain('Edit document');
    await second.click('Edit document');
    await act(async () => editor.onTitleChange('Second tab'));
    expect(localStorage.length).toBeGreaterThanOrEqual(2);
  } finally {
    await second.close();
  }
});

it('forwards embedded document assets to the shared editor', async () => {
  const ui = await setup();
  try {
    const assets = {
      image: {
        id: 'image',
        mediaType: 'image/png',
        encoding: 'base64',
        data: 'AA==',
        createdAt: 1,
        updatedAt: 1,
      },
    };
    await ui.render({assets});
    expect(editor.assets).toBe(assets);
  } finally {
    await ui.close();
  }
});

it('a duplicated tab never deletes its source tab draft when saving or discarding its copy', async () => {
  const first = await setup();
  await first.click('Edit document');
  const source = Object.keys(localStorage)[0]!,
    original = localStorage.getItem(source);
  // sessionStorage remains copied as it would in a duplicated tab.
  const duplicate = await setup();
  try {
    await duplicate.click('Discard draft');
    expect(localStorage.getItem(source)).toBe(original);
  } finally {
    await duplicate.close();
    await first.close();
  }
});

it('recovering an uncertain save in a new tab locks editing and retries its original receipt', async () => {
  const first = await setup();
  await first.click('Edit document');
  request.mockRejectedValueOnce(new Error('offline'));
  await first.click('Save draft');
  const original = request.mock.calls[0]![1];
  await first.close();
  sessionStorage.clear();
  const next = await setup();
  try {
    const recover = [...next.host.querySelectorAll('button')].find((b) =>
      b.textContent?.startsWith('Recover local draft:'),
    )!;
    await act(async () => recover.click());
    expect(editor.readOnly).toBe(true);
    request.mockRejectedValueOnce(new Error('still offline'));
    await next.click('Retry same save');
    expect(request.mock.calls[1]![1]).toEqual(original);
  } finally {
    await next.close();
  }
});
