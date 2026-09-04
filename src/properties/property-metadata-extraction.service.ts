import { Inject, Injectable } from '@nestjs/common';
import {
  PROPERTY_TYPES,
  Property,
  PropertyType,
  normalizePropertyType,
} from './property.entity';
import { AI_PROVIDER, AiProvider } from './ai-provider.interface';

export type ExtractedPropertyMetadata = {
  priceAmount: number | null;
  priceCurrency: string | null;
  squareMeters: number | null;
  propertyType: PropertyType | null;
  areaName: string | null;
};

type RawExtractedPropertyMetadata = {
  priceAmount?: unknown;
  priceCurrency?: unknown;
  squareMeters?: unknown;
  propertyType?: unknown;
  area?: unknown;
};

type RawExtractedPropertyMetadataItem = RawExtractedPropertyMetadata & {
  index?: unknown;
};

type PropertySource = Pick<Property, 'title' | 'description' | 'price' | 'url'>;

@Injectable()
export class PropertyMetadataExtractionService {
  constructor(@Inject(AI_PROVIDER) private readonly aiProvider: AiProvider) {}

  async extract(
    property: PropertySource,
    activeAreaNames: string[] = [],
  ): Promise<ExtractedPropertyMetadata> {
    const sourceText = this.buildSourceText(property);
    const rawText = await this.aiProvider.generateText(
      this.buildPrompt(property, activeAreaNames),
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

  async extractMany(
    properties: PropertySource[],
    activeAreaNames: string[] = [],
  ): Promise<ExtractedPropertyMetadata[]> {
    if (properties.length === 0) {
      return [];
    }

    const rawText = await this.aiProvider.generateText(
      this.buildBulkPrompt(properties, activeAreaNames),
      {
        responseMimeType: 'application/json',
      },
    );

    if (!rawText) {
      throw new Error(
        'AI provider returned no response for batch metadata extraction',
      );
    }

    return this.parseBulkProviderResponse(rawText, properties);
  }

  private buildPrompt(
    property: PropertySource,
    activeAreaNames: string[],
  ): string {
    return [
      'Extract normalized real-estate data from the listing below.',
      'Return JSON only, with this exact shape:',
      '{"priceAmount": number | null, "priceCurrency": string | null, "squareMeters": number | null, "propertyType": string | null, "area": string | null}',
      'Rules:',
      '- priceAmount must be an integer, without currency symbols or thousands separators.',
      '- priceCurrency should be a 3-letter ISO code when confidently inferable, otherwise null.',
      '- squareMeters may be decimal in the source, but return it as the nearest integer number of square meters.',
      '- If both total and net area are present, prefer total area.',
      `- propertyType must be exactly one of: ${PROPERTY_TYPES.join(', ')}.`,
      `- area is the neighborhood/zone the listing is in. Known neighborhoods so far: ${activeAreaNames.join(', ') || '(none yet)'}. Return exactly one of these known values when the listing clearly matches one, or a new neighborhood name if the listing mentions one that isn't in that list, or null when no neighborhood can be confidently determined.`,
      '- Use null when a value cannot be determined confidently.',
      '',
      `Title: ${property.title ?? ''}`,
      `Raw price: ${property.price ?? ''}`,
      `Description: ${property.description ?? ''}`,
      `URL: ${property.url ?? ''}`,
    ].join('\n');
  }

  private buildSourceText(property: PropertySource): string {
    return [
      property.title ?? '',
      property.description ?? '',
      property.price ?? '',
      property.url ?? '',
    ].join('\n');
  }

  private buildBulkPrompt(
    properties: PropertySource[],
    activeAreaNames: string[],
  ): string {
    const listings = properties
      .map((property, index) => this.buildListingBlock(property, index))
      .join('\n\n');

    return [
      'Extract normalized real-estate data from each listing below.',
      'Return JSON only, as an array with exactly one object per listing, each in this exact shape:',
      '{"index": number, "priceAmount": number | null, "priceCurrency": string | null, "squareMeters": number | null, "propertyType": string | null, "area": string | null}',
      'Rules:',
      '- index must match the listing\'s "Listing #" number exactly, so each result can be matched back to its listing.',
      '- Return exactly one result object for every listing below, even when all of its fields are null.',
      '- priceAmount must be an integer, without currency symbols or thousands separators.',
      '- priceCurrency should be a 3-letter ISO code when confidently inferable, otherwise null.',
      '- squareMeters may be decimal in the source, but return it as the nearest integer number of square meters.',
      '- If both total and net area are present, prefer total area.',
      `- propertyType must be exactly one of: ${PROPERTY_TYPES.join(', ')}.`,
      `- area is the neighborhood/zone the listing is in. Known neighborhoods so far: ${activeAreaNames.join(', ') || '(none yet)'}. Return exactly one of these known values when the listing clearly matches one, or a new neighborhood name if the listing mentions one that isn't in that list, or null when no neighborhood can be confidently determined.`,
      '- Use null when a value cannot be determined confidently.',
      '',
      listings,
    ].join('\n');
  }

  private buildListingBlock(property: PropertySource, index: number): string {
    return [
      `Listing # ${index}`,
      `Title: ${property.title ?? ''}`,
      `Raw price: ${property.price ?? ''}`,
      `Description: ${property.description ?? ''}`,
      `URL: ${property.url ?? ''}`,
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
      const parsed = JSON.parse(jsonMatch[0]) as RawExtractedPropertyMetadata;

      return {
        priceAmount: this.toPositiveIntegerOrNull(parsed.priceAmount),
        priceCurrency: this.toCurrencyOrNull(parsed.priceCurrency),
        squareMeters:
          this.toRoundedPositiveIntegerOrNull(parsed.squareMeters) ??
          this.extractSquareMetersFromText(sourceText),
        propertyType: this.toPropertyTypeOrNull(parsed.propertyType),
        areaName: this.toAreaNameOrNull(parsed.area),
      };
    } catch {
      return {
        ...this.emptyResult(),
        squareMeters: this.extractSquareMetersFromText(sourceText),
      };
    }
  }

  private parseBulkProviderResponse(
    rawText: string,
    properties: PropertySource[],
  ): ExtractedPropertyMetadata[] {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      throw new Error(
        'AI batch metadata response did not contain a JSON array',
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('AI batch metadata response was not valid JSON');
    }

    if (!Array.isArray(parsed)) {
      throw new Error('AI batch metadata response was not a JSON array');
    }

    const itemsByIndex = new Map<number, RawExtractedPropertyMetadataItem>();

    for (const item of parsed as unknown[]) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as RawExtractedPropertyMetadataItem).index === 'number'
      ) {
        const typedItem = item as RawExtractedPropertyMetadataItem;
        itemsByIndex.set(typedItem.index as number, typedItem);
      }
    }

    return properties.map((property, index) => {
      const item = itemsByIndex.get(index);

      if (!item) {
        throw new Error(
          `AI batch metadata response is missing a result for listing index ${index}`,
        );
      }

      const sourceText = this.buildSourceText(property);

      return {
        priceAmount: this.toPositiveIntegerOrNull(item.priceAmount),
        priceCurrency: this.toCurrencyOrNull(item.priceCurrency),
        squareMeters:
          this.toRoundedPositiveIntegerOrNull(item.squareMeters) ??
          this.extractSquareMetersFromText(sourceText),
        propertyType: this.toPropertyTypeOrNull(item.propertyType),
        areaName: this.toAreaNameOrNull(item.area),
      };
    });
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
      propertyType: null,
      areaName: null,
    };
  }

  private toPropertyTypeOrNull(value: unknown): PropertyType | null {
    return normalizePropertyType(value);
  }

  private toAreaNameOrNull(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
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
      const parsed = this.parseSquareMetersValue(match?.[1]);

      if (parsed !== null) {
        return parsed;
      }
    }

    const genericMatches = normalizedSource.matchAll(
      /([0-9]+(?:[.,][0-9]+)?)\s*m(?:2|²)\b/gi,
    );

    for (const match of genericMatches) {
      const parsed = this.parseSquareMetersValue(match[1]);

      if (parsed !== null) {
        return parsed;
      }
    }

    return null;
  }

  private parseSquareMetersValue(value: string | undefined): number | null {
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
