import { useEffect, useRef } from 'react';

type ShortcutMap = Record<string, () => void>;

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      const shortcutKey = isMod ? `mod+${key}` : key;

      if (shortcutsRef.current[shortcutKey]) {
        event.preventDefault();
        shortcutsRef.current[shortcutKey]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
