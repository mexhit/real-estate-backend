export const AI_PROVIDER = 'AI_PROVIDER';

export type AiGenerationOptions = {
  responseMimeType?: string;
};

export interface AiProvider {
  generateText(
    prompt: string,
    options?: AiGenerationOptions,
  ): Promise<string | null>;
}
