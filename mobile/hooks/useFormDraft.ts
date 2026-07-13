import { useEffect, useRef, useState } from 'react';
import {
  clearFormDraft,
  hasFormDraftContent,
  loadFormDraft,
  saveFormDraft,
} from '../library/formDraftStorage';

interface UseFormDraftOptions<T> {
  formKey: string;
  userId?: number;
  formData: T;
  setFormData: React.Dispatch<React.SetStateAction<T>>;
  debounceMs?: number;
  isEmpty?: (data: T) => boolean;
}

export function useFormDraft<T>({
  formKey,
  userId,
  formData,
  setFormData,
  debounceMs = 500,
  isEmpty,
}: UseFormDraftOptions<T>) {
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const skipSaveRef = useRef(true);

  const checkEmpty =
    isEmpty ?? ((data: T) => !hasFormDraftContent(data as Record<string, unknown>));

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      const draft = await loadFormDraft<T>(formKey, userId);
      if (cancelled) return;

      if (draft && !checkEmpty(draft)) {
        setFormData(draft);
        setDraftRestored(true);
        console.log(`useFormDraft restored: ${formKey}`);
      }

      skipSaveRef.current = false;
      setDraftReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [formKey, userId, setFormData]);

  useEffect(() => {
    if (!userId || !draftReady || skipSaveRef.current) return;

    const timer = setTimeout(() => {
      if (checkEmpty(formData)) {
        clearFormDraft(formKey, userId);
        return;
      }
      saveFormDraft(formKey, userId, formData);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [formData, formKey, userId, draftReady, debounceMs]);

  const clearDraft = async () => {
    if (!userId) return;
    await clearFormDraft(formKey, userId);
    setDraftRestored(false);
  };

  return { draftRestored, draftReady, clearDraft };
}
