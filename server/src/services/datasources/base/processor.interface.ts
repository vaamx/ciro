export interface IDataSourceProcessor<TInput, TOutput> {
  // Define common processing methods, e.g., process(), validate(), etc.
  // Placeholder - to be defined based on analysis of existing services.
  process(data: TInput): Promise<TOutput>;
} 