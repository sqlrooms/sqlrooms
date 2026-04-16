import {appendSemanticLayoutPath} from '../node-renderers/utils';

describe('appendSemanticLayoutPath', () => {
  it('skips generated dock split ids in semantic panel paths', () => {
    const path = appendSemanticLayoutPath(['dashboards', 'overview'], {
      type: 'split',
      id: 'dock-abc123',
      direction: 'row',
      children: ['left', 'right'],
    });

    expect(path).toEqual(['dashboards', 'overview']);
  });

  it('keeps authored split ids in semantic panel paths', () => {
    const path = appendSemanticLayoutPath(['root'], {
      type: 'split',
      id: 'main',
      direction: 'row',
      children: ['left', 'right'],
    });

    expect(path).toEqual(['root', 'main']);
  });
});
