import {CrdtDocStorage} from '../createCrdtSlice';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function fromBase64(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

type LocalStorageDocStorageOptions = {
  key: string;
};

export function createLocalStorageDocStorage({
  key,
}: LocalStorageDocStorageOptions): CrdtDocStorage {
  return {
    async load() {
      if (typeof window === 'undefined') return undefined;
      const raw = window.localStorage.getItem(key);
      if (!raw) return undefined;
      try {
        return fromBase64(raw);
      } catch (error) {
        console.warn('Failed to decode CRDT snapshot', error);
        return undefined;
      }
    },
    async save(data: Uint8Array) {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(key, toBase64(data));
      } catch (error) {
        console.warn('Failed to persist CRDT snapshot', error);
      }
    },
  };
}
