# Forms Feature

This directory contains the services and strategies related to generating dynamic connection forms and testing connections for various data sources.

## Purpose

The primary goal of this feature is to provide a consistent way to:
1.  Generate UI form schemas (`FormSchema`) based on the requirements of a specific data source type (e.g., Snowflake needs account, user, password; others might need API keys).
2.  Test the connection to a data source using the credentials provided through the generated form.
3.  Optionally list resources available via a connection (e.g., databases, schemas, warehouses) to populate subsequent UI elements.

## Architecture

This feature utilizes a **Strategy Pattern**:

-   **`FormsService` (`forms.service.ts`):** The main entry point. It delegates tasks to the appropriate strategy based on the `dataSourceType`.
-   **`IFormsStrategy` (`forms.strategy.interface.ts`):** Defines the contract that each data source-specific strategy must implement (e.g., `getFormSchema`, `testConnection`, optional `listX` methods).
-   **Strategy Implementations (`strategies/`):** Concrete implementations for each data source type (e.g., `SnowflakeFormsStrategy`). Each strategy knows how to generate its specific form and test its connection type.
-   **`FormsModule` (`forms.module.ts`):** Registers the `FormsService` and uses a factory provider (`FORMS_STRATEGY_MAP`) to create and inject a map of available strategies into the `FormsService`.

## Adding Support for a New Data Source

1.  **Create Strategy:** Implement the `IFormsStrategy` interface in a new file within the `strategies/` directory (e.g., `MySqlFormsStrategy.ts`). Implement the required methods (`getFormSchema`, `testConnection`) and any optional resource listing methods relevant to the source.
2.  **Register Strategy:**
    *   Import the new strategy into `FormsModule`.
    *   Add the new strategy class to the `providers` array in `FormsModule`.
    *   Add the new strategy class to the `inject` array within the `FORMS_STRATEGY_MAP` factory provider definition.
    *   Add an `else if` block within the `useFactory` function of the `FORMS_STRATEGY_MAP` provider to map the `dataSourceType` string (lowercase) to the injected strategy instance.

## Key Files

-   [`forms.service.ts`](forms.service.ts): Core service orchestrating form generation and connection testing.
-   [`forms.strategy.interface.ts`](forms.strategy.interface.ts): Defines the interface for all form strategies.
-   [`forms.module.ts`](forms.module.ts): NestJS module configuration, strategy registration.
-   [`strategies/`](strategies/): Directory containing individual strategy implementations (e.g., `snowflake.forms.strategy.ts`). 