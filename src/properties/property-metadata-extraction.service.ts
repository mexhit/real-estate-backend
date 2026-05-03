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
    const sourceText = this.buildSourceText(property);
    const rawText = await this.aiProvider.generateText(
      this.buildPrompt(property),
      {
        responseMimeType: 'application/json',
      },
    );

    if (!rawText) {
      return {
        ...this.emptyResult(),
        squareMeters: this.extractSquareMetersFromText(sourceText),
      };
    }

    return this.parseProviderResponse(rawText, sourceText);
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
      '- squareMeters may be decimal in the source, but return it as the nearest integer number of square meters.',
      '- If both total and net area are present, prefer total area.',
      '- Use null when a value cannot be determined confidently.',
      '',
      `Title: ${property.title ?? ''}`,
      `Raw price: ${property.price ?? ''}`,
      `Description: ${property.description ?? ''}`,
      `URL: ${property.url ?? ''}`,
    ].join('\n');
  }

  private buildSourceText(
    property: Pick<Property, 'title' | 'description' | 'price' | 'url'>,
  ): string {
    return [
      property.title ?? '',
      property.description ?? '',
      property.price ?? '',
      property.url ?? '',
    ].join('\n');
  }

  private parseProviderResponse(
    rawText: string,
    sourceText: string,
  ): ExtractedPropertyMetadata {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return {
        ...this.emptyResult(),
        squareMeters: this.extractSquareMetersFromText(sourceText),
      };
    }

    try {
      const parsed = JSON.parse(
        jsonMatch[0],
      ) as Partial<ExtractedPropertyMetadata>;

      return {
        priceAmount: this.toPositiveIntegerOrNull(parsed.priceAmount),
        priceCurrency: this.toCurrencyOrNull(parsed.priceCurrency),
        squareMeters:
          this.toRoundedPositiveIntegerOrNull(parsed.squareMeters) ??
          this.extractSquareMetersFromText(sourceText),
      };
    } catch {
      return {
        ...this.emptyResult(),
        squareMeters: this.extractSquareMetersFromText(sourceText),
      };
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

  private toRoundedPositiveIntegerOrNull(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return null;
    }

    return Math.round(value);
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

  private extractSquareMetersFromText(sourceText: string): number | null {
    const normalizedSource = sourceText
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const prioritizedPatterns = [
      /siperfaqe\s+totale[^0-9]*([0-9]+(?:[.,][0-9]+)?)\s*m(?:2|²)\b/i,
      /sip[eë]rfaqe\s+totale[^0-9]*([0-9]+(?:[.,][0-9]+)?)/i,
      /surface\s+totale[^0-9]*([0-9]+(?:[.,][0-9]+)?)\s*m(?:2|²)\b/i,
      /total\s+area[^0-9]*([0-9]+(?:[.,][0-9]+)?)\s*m(?:2|²)\b/i,
    ];

    for (const pattern of prioritizedPatterns) {
      const match = normalizedSource.match(pattern);
      const parsed = this.parseAreaValue(match?.[1]);

      if (parsed !== null) {
        return parsed;
      }
    }

    const genericMatches = normalizedSource.matchAll(
      /([0-9]+(?:[.,][0-9]+)?)\s*m(?:2|²)\b/gi,
    );

    for (const match of genericMatches) {
      const parsed = this.parseAreaValue(match[1]);

      if (parsed !== null) {
        return parsed;
      }
    }

    return null;
  }

  private parseAreaValue(value: string | undefined): number | null {
    if (!value) {
      return null;
    }

    const normalized = value.replace(',', '.');
    const parsed = Number(normalized);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Math.round(parsed);
  }
}
