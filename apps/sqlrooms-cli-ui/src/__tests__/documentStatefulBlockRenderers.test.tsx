import type {BlockDocumentStatefulBlockRenderer} from '@sqlrooms/documents';
import {renderToStaticMarkup} from 'react-dom/server';
import {DOCUMENT_CHARTS_MAPS_CLI_CAPABILITY_PROFILE} from '../profiles';
import {
  createProfiledDocumentStatefulBlockRenderers,
  ProfileDisabledStatefulBlockPlaceholder,
} from '../workspace/documentStatefulBlockRenderers';

describe('document stateful block renderers', () => {
  it('keeps map enabled and replaces a disabled default block', () => {
    const renderer =
      (blockType: string): BlockDocumentStatefulBlockRenderer =>
      () => <div>{blockType}</div>;
    const registeredRenderers = {
      dashboard: renderer('dashboard'),
      map: renderer('map'),
      pivot: renderer('pivot'),
      'data-table': renderer('data-table'),
      markdown: renderer('markdown'),
      'sql-query': renderer('sql-query'),
      'html-app': renderer('html-app'),
      python: renderer('python'),
    };

    const renderers = createProfiledDocumentStatefulBlockRenderers(
      DOCUMENT_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
      registeredRenderers,
    );

    expect(renderers.map).toBe(registeredRenderers.map);
    expect(renderers['data-table']).toBe(
      ProfileDisabledStatefulBlockPlaceholder,
    );

    const markup = renderToStaticMarkup(
      <ProfileDisabledStatefulBlockPlaceholder
        documentId="document-1"
        blockId="table-1"
        blockType="data-table"
        blockInstanceId="table-1"
      />,
    );
    expect(markup).toContain(
      'This block is disabled by the selected capability profile.',
    );
    expect(markup).toContain(
      'Reopen this project with a profile that enables it to view and edit it.',
    );
    expect(markup).not.toContain('--experimental');
    expect(markup).not.toContain('experimental SQLRooms surface');
  });
});
