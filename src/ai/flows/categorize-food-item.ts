'use server';
/**
 * @fileOverview This file defines a Genkit flow for categorizing food items based on an image.
 *
 * The flow takes an image data URI as input and returns a suggested food category.
 * It uses the Gemini Vision model to analyze the image and identify the food type.
 *
 * @exports {
 *   categorizeFoodItem: (input: CategorizeFoodItemInput) => Promise<CategorizeFoodItemOutput>;
 *   CategorizeFoodItemInput: type
 *   CategorizeFoodItemOutput: type
 * }
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

/**
 * Input schema for the categorizeFoodItem flow.
 */
const CategorizeFoodItemInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      'A photo of the food item, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
    ),
});
export type CategorizeFoodItemInput = z.infer<typeof CategorizeFoodItemInputSchema>;

/**
 * Output schema for the categorizeFoodItem flow.
 */
const CategorizeFoodItemOutputSchema = z.object({
  category: z.string().describe('The suggested category for the food item.'),
  tags: z.array(z.string()).describe('Relevant tags for the food item.'),
});
export type CategorizeFoodItemOutput = z.infer<typeof CategorizeFoodItemOutputSchema>;

/**
 * Categorizes a food item based on an image.
 *
 * @param input - The input containing the photo data URI.
 * @returns The suggested food category and relevant tags.
 */
export async function categorizeFoodItem(
  input: CategorizeFoodItemInput
): Promise<CategorizeFoodItemOutput> {
  return categorizeFoodItemFlow(input);
}

const categorizeFoodItemPrompt = ai.definePrompt({
  name: 'categorizeFoodItemPrompt',
  input: {schema: CategorizeFoodItemInputSchema},
  output: {schema: CategorizeFoodItemOutputSchema},
  prompt: `You are an AI assistant specialized in food recognition and categorization.
  Given an image of a food item, you will identify the food type and suggest a category and relevant tags for it.

  Analyze the following image and provide the category and tags:
  Image: {{media url=photoDataUri}}

  Format your response as a JSON object with "category" and "tags" fields.
  Example: {\"category\": \"Fruits\", \"tags\": [\"apple\", \"fresh\", \"red\"]}
  `,
});

const categorizeFoodItemFlow = ai.defineFlow(
  {
    name: 'categorizeFoodItemFlow',
    inputSchema: CategorizeFoodItemInputSchema,
    outputSchema: CategorizeFoodItemOutputSchema,
  },
  async input => {
    const {output} = await categorizeFoodItemPrompt(input);
    return output!;
  }
);
