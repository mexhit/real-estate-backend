export interface RunnableJob {
  run(): Promise<unknown>;
}
