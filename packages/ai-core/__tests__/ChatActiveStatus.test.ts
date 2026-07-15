import type {UIMessage} from 'ai';
import {getChatActiveStatus} from '../src/components/ChatActiveStatus';

describe('getChatActiveStatus', () => {
  it('distinguishes the initial model wait from continued analysis', () => {
    const userMessage = message('user', [{type: 'text', text: 'hello'}]);
    expect(getChatActiveStatus([userMessage])).toMatchObject({
      label: 'Waiting for model…',
      kind: 'model',
    });

    expect(
      getChatActiveStatus([
        userMessage,
        message('assistant', [{type: 'text', text: 'Working on it'}]),
      ]),
    ).toMatchObject({label: 'Continuing analysis…', kind: 'model'});
  });

  it('describes the latest pending tool with useful fallbacks', () => {
    expect(
      getChatActiveStatus([
        message('user', [{type: 'text', text: 'chart sales'}]),
        message('assistant', [
          {
            type: 'tool-createVegaChart',
            toolCallId: 'tool-1',
            state: 'input-available',
            input: {},
          },
        ]),
      ]),
    ).toMatchObject({label: 'Creating chart…', kind: 'tool'});
  });

  it('prefers activity and display labels from toolRenderBehavior', () => {
    const messages = [
      message('user', [{type: 'text', text: 'save'}]),
      message('assistant', [
        {
          type: 'tool-saveSkill',
          toolCallId: 'tool-1',
          state: 'input-available',
          input: {},
        },
      ]),
    ];

    expect(
      getChatActiveStatus(messages, {
        getActivityLabel: () => 'Saving the skill',
      }).label,
    ).toBe('Saving the skill…');
    expect(
      getChatActiveStatus(messages, {
        getToolDisplayName: () => 'skill writer',
      }).label,
    ).toBe('Running skill writer…');
  });

  it('shows approval waits without describing the tool as running', () => {
    expect(
      getChatActiveStatus([
        message('user', [{type: 'text', text: 'delete it'}]),
        message('assistant', [
          {
            type: 'dynamic-tool',
            toolName: 'deleteItem',
            toolCallId: 'tool-1',
            state: 'approval-requested',
            input: {},
          },
        ]),
      ]),
    ).toMatchObject({label: 'Waiting for approval…', kind: 'approval'});
  });

  it('ignores incomplete tools from earlier turns', () => {
    expect(
      getChatActiveStatus([
        message('user', [{type: 'text', text: 'old'}]),
        message('assistant', [
          {
            type: 'tool-query',
            toolCallId: 'old-tool',
            state: 'input-available',
            input: {},
          },
        ]),
        message('user', [{type: 'text', text: 'new'}]),
      ]),
    ).toMatchObject({label: 'Waiting for model…', kind: 'model'});
  });
});

function message(
  role: UIMessage['role'],
  parts: UIMessage['parts'],
): UIMessage {
  return {id: `${role}-${Math.random()}`, role, parts};
}
