import { useEffect } from 'react';

/** Sets `document.title` on mount and whenever `title` changes. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
