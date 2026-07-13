import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_PREFIX = 'parish_form_draft_';

function draftKey(formKey: string, userId: number): string {
  return `${DRAFT_PREFIX}${formKey}_${userId}`;
}

export async function saveFormDraft<T>(formKey: string, userId: number, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(draftKey(formKey, userId), JSON.stringify(data));
    console.log(`Form draft saved: ${formKey}`);
  } catch (error) {
    console.error(`Failed to save form draft (${formKey}):`, error);
  }
}

export async function loadFormDraft<T>(formKey: string, userId: number): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(draftKey(formKey, userId));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Failed to load form draft (${formKey}):`, error);
    return null;
  }
}

export async function clearFormDraft(formKey: string, userId: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(draftKey(formKey, userId));
    console.log(`Form draft cleared: ${formKey}`);
  } catch (error) {
    console.error(`Failed to clear form draft (${formKey}):`, error);
  }
}

export function hasFormDraftContent(values: Record<string, unknown>): boolean {
  return Object.values(values).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return value != null && value !== '';
  });
}
