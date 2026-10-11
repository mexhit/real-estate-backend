export const DECISION_PROVIDER = 'DECISION_PROVIDER';

export type YesNoCriteria = {
  true: string;
  false: string;
};

export interface DecisionProvider {
  /**
   * Returns the probability (0-1) that the answer to the question is yes,
   * or null when the provider cannot answer (e.g. no API key configured).
   */
  decideYesNo(
    state: string,
    instructions: string,
    criteria: YesNoCriteria,
  ): Promise<number | null>;
}
