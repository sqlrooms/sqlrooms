import {restoreExpandedPanelSize} from '../node-renderers/split-node-renderer/restoreExpandedPanelSize';

describe('restoreExpandedPanelSize', () => {
  it('resizes to the declared default instead of restoring stale panel history', () => {
    const handle = {
      resize: jest.fn(),
      expand: jest.fn(),
      isCollapsed: jest.fn(() => false),
    };

    restoreExpandedPanelSize(handle, '30%');

    expect(handle.resize).toHaveBeenCalledWith('30%');
    expect(handle.expand).not.toHaveBeenCalled();
  });

  it('uses normal expansion when no default size is declared', () => {
    const handle = {
      resize: jest.fn(),
      expand: jest.fn(),
      isCollapsed: jest.fn(() => false),
    };

    restoreExpandedPanelSize(handle, undefined);

    expect(handle.expand).toHaveBeenCalledTimes(1);
    expect(handle.resize).not.toHaveBeenCalled();
  });

  it('falls back to expansion when resizing below the minimum snaps closed', () => {
    const handle = {
      resize: jest.fn(),
      expand: jest.fn(),
      isCollapsed: jest.fn(() => true),
    };

    restoreExpandedPanelSize(handle, '20%');

    expect(handle.resize).toHaveBeenCalledWith('20%');
    expect(handle.expand).toHaveBeenCalledTimes(1);
  });
});
