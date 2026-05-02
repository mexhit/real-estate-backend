import { Inject, Injectable } from '@nestjs/common';
import { Property } from './property.entity';
import { AI_PROVIDER, AiProvider } from './ai-provider.interface';

type ExtractedPropertyMetadata = {
  priceAmount: number | null;
  priceCurrency: string | null;
  squareMeters: number | null;
};

@Injectable()
export class PropertyMetadataExtractionService {
  constructor(@Inject(AI_PROVIDER) private readonly aiProvider: AiProvider) {}

  async extract(
    property: Pick<Property, 'title' | 'description' | 'price' | 'url'>,
  ): Promise<ExtractedPropertyMetadata> {
    const rawText = await this.aiProvider.generateText(
      this.buildPrompt(property),
      {
        responseMimeType: 'application/json',
      },
    );

    if (!rawText) {
      return this.emptyResult();
    }

    return this.parseGeminiResponse(rawText);
  }

  private buildPrompt(
    property: Pick<Property, 'title' | 'description' | 'price' | 'url'>,
  ): string {
    return [
      'Extract normalized real-estate data from the listing below.',
      'Return JSON only, with this exact shape:',
      '{"priceAmount": number | null, "priceCurrency": string | null, "squareMeters": number | null}',
      'Rules:',
      '- priceAmount must be an integer, without currency symbols or thousands separators.',
      '- priceCurrency should be a 3-letter ISO code when confidently inferable, otherwise null.',
      '- squareMeters must be an integer value in square meters.',
      '- Use null when a value cannot be determined confidently.',
      '',
      `Title: ${property.title ?? ''}`,
      `Raw price: ${property.price ?? ''}`,
      `Description: ${property.description ?? ''}`,
      `URL: ${property.url ?? ''}`,
    ].join('\n');
  }

  private parseGeminiResponse(rawText: string): ExtractedPropertyMetadata {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return this.emptyResult();
    }

    try {
      const parsed = JSON.parse(
        jsonMatch[0],
      ) as Partial<ExtractedPropertyMetadata>;

      return {
        priceAmount: this.toPositiveIntegerOrNull(parsed.priceAmount),
        priceCurrency: this.toCurrencyOrNull(parsed.priceCurrency),
        squareMeters: this.toPositiveIntegerOrNull(parsed.squareMeters),
      };
    } catch {
      return this.emptyResult();
    }
  }

  private toPositiveIntegerOrNull(value: unknown): number | null {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      !Number.isInteger(value) ||
      value <= 0
    ) {
      return null;
    }

    return value;
  }

  private toCurrencyOrNull(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim().toUpperCase();

    return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
  }

  private emptyResult(): ExtractedPropertyMetadata {
    return {
      priceAmount: null,
      priceCurrency: null,
      squareMeters: null,
    };
  }
}
