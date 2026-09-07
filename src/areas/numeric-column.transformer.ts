import { ValueTransformer } from 'typeorm';

export const numericColumnTransformer: ValueTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null =>
    value === null ? null : parseFloat(value),
};
