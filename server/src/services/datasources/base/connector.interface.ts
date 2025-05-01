export interface IDataSourceConnector {
  // Define common connection methods, e.g., connect(), disconnect(), query(), etc.
  // Placeholder - to be defined based on analysis of existing services.
  ping(): Promise<boolean>;
} 