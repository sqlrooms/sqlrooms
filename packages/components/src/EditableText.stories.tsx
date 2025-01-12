import EditableText from './EditableText';
import {useState} from 'react';

export const EditableTextStory = () => {
  const [value, setValue] = useState('Hello');
  return (
    <EditableText
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue);
        return nextValue;
      }}
      error={undefined}
      isLoading={false}
    />
  );
};
