import {PlusIcon} from 'lucide-react';

export function AddChildButton({onClick}: {onClick: () => void}) {
  return (
    <button
      onClick={onClick}
      className="absolute -right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"
      title="Add child node"
    >
      <PlusIcon className="h-4 w-4" />
    </button>
  );
}
