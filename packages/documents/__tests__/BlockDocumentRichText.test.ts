import {
  blockDocumentBlockToNode,
  blockDocumentNodeToBlock,
  type BlockDocumentHeadingBlock,
  type BlockDocumentParagraphBlock,
  type BlockDocumentListBlock,
} from '../src/BlockDocumentSliceConfig';

describe('BlockDocument rich text support', () => {
  describe('heading blocks with rich text', () => {
    it('should convert heading block with bold text to TipTap node', () => {
      const block: BlockDocumentHeadingBlock = {
        type: 'heading',
        id: 'test-id',
        level: 2,
        text: [{type: 'text', text: 'Bold heading', marks: [{type: 'bold'}]}],
      };

      const node = blockDocumentBlockToNode(block);

      expect(node.type).toBe('heading');
      expect(node.attrs?.level).toBe(2);
      expect(node.content).toHaveLength(1);
      expect(node.content?.[0]).toEqual({
        type: 'text',
        text: 'Bold heading',
        marks: [{type: 'bold'}],
      });
    });

    it('should convert TipTap node with italic text back to heading block', () => {
      const node = {
        type: 'heading',
        attrs: {id: 'test-id', level: 2},
        content: [
          {type: 'text', text: 'Italic heading', marks: [{type: 'italic'}]},
        ],
      };

      const block = blockDocumentNodeToBlock(node);

      expect(block).toMatchObject({
        type: 'heading',
        id: 'test-id',
        level: 2,
        text: [
          {type: 'text', text: 'Italic heading', marks: [{type: 'italic'}]},
        ],
      });
    });
  });

  describe('paragraph blocks with rich text', () => {
    it('should convert paragraph with mixed formatting', () => {
      const block: BlockDocumentParagraphBlock = {
        type: 'paragraph',
        id: 'test-id',
        text: [
          {type: 'text', text: 'Normal text '},
          {type: 'text', text: 'bold', marks: [{type: 'bold'}]},
          {type: 'text', text: ' and '},
          {type: 'text', text: 'italic', marks: [{type: 'italic'}]},
        ],
      };

      const node = blockDocumentBlockToNode(block);

      expect(node.type).toBe('paragraph');
      expect(node.content).toHaveLength(4);
      expect(node.content?.[1]).toEqual({
        type: 'text',
        text: 'bold',
        marks: [{type: 'bold'}],
      });
    });

    it('should preserve code mark', () => {
      const block: BlockDocumentParagraphBlock = {
        type: 'paragraph',
        id: 'test-id',
        text: [
          {type: 'text', text: 'Use '},
          {type: 'text', text: 'const', marks: [{type: 'code'}]},
          {type: 'text', text: ' here'},
        ],
      };

      const node = blockDocumentBlockToNode(block);
      const roundtrip = blockDocumentNodeToBlock(node);

      expect(roundtrip).toMatchObject({
        type: 'paragraph',
        text: [
          {type: 'text', text: 'Use '},
          {type: 'text', text: 'const', marks: [{type: 'code'}]},
          {type: 'text', text: ' here'},
        ],
      });
    });
  });

  describe('list blocks with rich text', () => {
    it('should convert list items with bold text', () => {
      const block: BlockDocumentListBlock = {
        type: 'list',
        id: 'test-id',
        ordered: false,
        items: [
          [{type: 'text', text: 'First item', marks: [{type: 'bold'}]}],
          [{type: 'text', text: 'Second item'}],
        ],
      };

      const node = blockDocumentBlockToNode(block);

      expect(node.type).toBe('bulletList');
      expect(node.content).toHaveLength(2);
      expect(node.content?.[0]?.type).toBe('listItem');
      expect(node.content?.[0]?.content?.[0]?.content?.[0]).toEqual({
        type: 'text',
        text: 'First item',
        marks: [{type: 'bold'}],
      });
    });

    it('should convert ordered list with mixed formatting', () => {
      const block: BlockDocumentListBlock = {
        type: 'list',
        id: 'test-id',
        ordered: true,
        items: [
          [
            {type: 'text', text: 'Step '},
            {type: 'text', text: '1', marks: [{type: 'bold'}]},
          ],
          [
            {type: 'text', text: 'Run '},
            {type: 'text', text: 'npm install', marks: [{type: 'code'}]},
          ],
        ],
      };

      const node = blockDocumentBlockToNode(block);
      const roundtrip = blockDocumentNodeToBlock(node);

      expect(roundtrip).toMatchObject({
        type: 'list',
        ordered: true,
        items: [
          [
            {type: 'text', text: 'Step '},
            {type: 'text', text: '1', marks: [{type: 'bold'}]},
          ],
          [
            {type: 'text', text: 'Run '},
            {type: 'text', text: 'npm install', marks: [{type: 'code'}]},
          ],
        ],
      });
    });
  });

  describe('empty content handling', () => {
    it('should handle empty text arrays', () => {
      const block: BlockDocumentParagraphBlock = {
        type: 'paragraph',
        id: 'test-id',
        text: [],
      };

      const node = blockDocumentBlockToNode(block);

      expect(node.type).toBe('paragraph');
      expect(node.content).toBeUndefined();
    });
  });
});
