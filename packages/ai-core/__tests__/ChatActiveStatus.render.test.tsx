/**
 * @jest-environment jsdom
 *
 * How `ChatActiveStatus` presents each kind of wait: an approval stops the
 * run, so it is named rather than animated.
 */
import {render, screen} from '@testing-library/react';
import {ChatActiveStatus} from '../src/components/ChatActiveStatus';

describe('ChatActiveStatus', () => {
  it('names an approval wait instead of animating it', () => {
    render(
      <ChatActiveStatus
        status={{
          key: 'approval:1',
          label: 'Waiting for approval…',
          kind: 'approval',
        }}
      />,
    );
    expect(screen.getByText('Paused…')).not.toBeNull();
  });

  it('leaves work in flight to the animated dots', () => {
    render(
      <ChatActiveStatus
        status={{
          key: 'model:waiting',
          label: 'Waiting for model…',
          kind: 'model',
        }}
      />,
    );
    expect(screen.queryByText('Paused…')).toBeNull();
    expect(screen.getByText('Waiting for model…')).not.toBeNull();
  });
});
