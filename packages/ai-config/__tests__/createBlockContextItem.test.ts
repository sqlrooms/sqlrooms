import {createBlockContextItem} from '../src/createBlockContextItem';
import {AiRunContextItemSchema} from '../src/schema/ChatSessionSchema';

describe('createBlockContextItem', () => {
  it('creates a schema-valid block context item with block fields', () => {
    const item = createBlockContextItem({
      id: 'block:document-1:block-1:panel-1',
      blockDocumentId: 'document-1',
      blockId: 'block-1',
      blockType: 'dashboard',
      blockInstanceId: 'dashboard-1',
      panelId: 'panel-1',
      title: 'Revenue dashboard',
      subtitle: 'Quarterly report',
    });

    expect(item).toEqual({
      kind: 'block',
      id: 'block:document-1:block-1:panel-1',
      title: 'Revenue dashboard',
      type: 'dashboard',
      subtitle: 'Quarterly report',
      blockDocumentId: 'document-1',
      blockId: 'block-1',
      blockType: 'dashboard',
      blockInstanceId: 'dashboard-1',
      panelId: 'panel-1',
    });
    expect(AiRunContextItemSchema.parse(item)).toEqual(item);
  });
});
