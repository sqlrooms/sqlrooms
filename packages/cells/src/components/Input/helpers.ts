import type {InputTypes, InputUnion} from '../../types';

export const initializeInput = (
  type: InputTypes,
  oldInput: InputUnion,
): InputUnion => {
  const name = oldInput.varName;
  switch (type) {
    case 'text':
      return {
        kind: 'text',
        varName: name,
        value: '',
      };
    case 'slider':
      return {
        kind: 'slider',
        varName: name,
        min: 0,
        max: 100,
        step: 1,
        value: 0,
      };
    case 'dropdown':
      return {
        kind: 'dropdown',
        varName: name,
        options: [],
        value: '',
      };
  }
};
