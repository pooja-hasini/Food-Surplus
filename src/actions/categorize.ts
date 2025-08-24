'use server';

import { categorizeFoodItem } from '@/ai/flows/categorize-food-item';
import type { CategorizeFoodItemOutput } from '@/ai/flows/categorize-food-item';

export async function handleCategorize(photoDataUri: string): Promise<CategorizeFoodItemOutput | { error: string }> {
  if (!photoDataUri.startsWith('data:image/')) {
    return { error: 'Invalid image data URI.' };
  }
  
  try {
    const result = await categorizeFoodItem({ photoDataUri });
    return result;
  } catch (e) {
    console.error(e);
    // It's better to return a generic error message to the client
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { error: `Failed to categorize image. ${errorMessage}` };
  }
}
