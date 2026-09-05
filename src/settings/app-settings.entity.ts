import { Column, Entity, PrimaryColumn } from 'typeorm';

export const AI_PROVIDER_TYPES = ['GEMINI', 'GEMINI_2', 'GROQ'] as const;

export type AiProviderType = (typeof AI_PROVIDER_TYPES)[number];

export const APP_SETTINGS_SINGLETON_ID = 1;

export const DEFAULT_AI_PROVIDER: AiProviderType = 'GEMINI';

@Entity()
export class AppSettings {
  @PrimaryColumn()
  id: number;

  @Column({ default: DEFAULT_AI_PROVIDER })
  aiProvider: AiProviderType;
}
