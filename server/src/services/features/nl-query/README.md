# Natural Language Query (NL Query) Feature

This directory contains the services and strategies for translating natural language questions into executable queries (primarily SQL) against various data sources.

## Purpose

The core function is to allow users to ask questions in plain English (e.g., "Show me total sales per region for last quarter") and have the system:
1.  Understand the intent of the query.
2.  Identify the relevant data source and tables/columns needed.
3.  Generate a syntactically correct SQL (or potentially other query language/API calls) query.
4.  Execute the query against the target data source.
5.  Return the results, potentially with reasoning about how the query was generated.

## Architecture

Similar to the Forms feature, this uses a **Strategy Pattern**:

-   **`NLQueryService` (`nl-query.service.ts`):** The main service that receives the natural language query and `dataSourceType`. It selects the appropriate strategy.
-   **`INLQueryStrategy` (`nl-query.strategy.interface.ts`):** Defines the contract for data source-specific NL query strategies. The key method is `executeNaturalLanguageQuery`.
-   **Strategy Implementations (`strategies/`):** Concrete implementations for different data source types (e.g., `SnowflakeNLQueryStrategy`). Each strategy handles:
    -   Retrieving relevant schema information (either directly from the source via its connector, e.g., `SnowflakeService`, or from a pre-indexed knowledge base like Qdrant).
    -   Constructing a prompt for an LLM (like GPT-4) including the natural language query and the schema context.
    -   Calling the LLM service (e.g., `OpenAIService`) to generate the SQL query.
    -   Executing the generated SQL using the appropriate data source connector service (e.g., `SnowflakeService`).
    -   Optionally generating reasoning for the query construction.
    -   Formatting and returning the `NLQueryResult`.
-   **`NLQueryModule` (`nl-query.module.ts` - *Assumed*):** A NestJS module (likely needed if not already present) would register the `NLQueryService` and use a factory provider (`NLQUERY_STRATEGY_MAP`) to manage the different strategies, similar to `FormsModule`.

## Adding Support for a New Data Source

1.  **Create Strategy:** Implement the `INLQueryStrategy` interface in a new file within the `strategies/` directory (e.g., `MySqlNLQueryStrategy.ts`). This implementation will need to:
    *   Inject necessary services (its corresponding data source connector, `OpenAIService`, potentially schema indexer/search services).
    *   Implement logic to fetch schema information relevant to the query.
    *   Implement prompt engineering logic suitable for the target data source's SQL dialect.
    *   Call the LLM and the data source connector.
2.  **Register Strategy:**
    *   Create or update the `NLQueryModule`.
    *   Import the new strategy into the module.
    *   Add the new strategy class to the `providers` array.
    *   Define or update the `NLQUERY_STRATEGY_MAP` factory provider: inject the new strategy and add an `else if` block in the factory function to map the `dataSourceType` string to the strategy instance.

## Key Files

-   [`nl-query.service.ts`](nl-query.service.ts): Core service orchestrating the NL query process.
-   [`nl-query.strategy.interface.ts`](nl-query.strategy.interface.ts): Defines the interface for all NL query strategies.
-   [`nl-query.module.ts`](nl-query.module.ts) (Assumed/Required): NestJS module configuration and strategy registration.
-   [`strategies/`](strategies/): Directory containing individual strategy implementations (e.g., `snowflake.nl-query.strategy.ts`). 