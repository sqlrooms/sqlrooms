import EditableText from './EditableText';
import {useState} from 'react';

export const EditableTextStory = () => {
  const [value, setValue] = useState('Hello');
  return (
    <EditableText
      value={value}
      onChange={setValue}
      error={undefined}
      isLoading={false}
    />
  );
};
