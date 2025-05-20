import { Module } from '@nestjs/common';
import { FormsService, FORMS_STRATEGY_MAP } from './forms.service';
import { SnowflakeFormsStrategy } from './strategies/snowflake.forms.strategy';
// Import other strategies here as they are created
// import { MySqlFormsStrategy } from './strategies/mysql.forms.strategy';

@Module({
  providers: [
    // Provide individual strategies
    SnowflakeFormsStrategy,
    // MySqlFormsStrategy, 
    
    // Provide the map of strategies
    {
      provide: FORMS_STRATEGY_MAP,
      useFactory: (...strategies) => {
        const map = new Map<string, any>();
        // Register strategies with their corresponding type key (lowercase)
        strategies.forEach(strategy => {
          if (strategy instanceof SnowflakeFormsStrategy) {
            map.set('snowflake', strategy);
          } 
          // else if (strategy instanceof MySqlFormsStrategy) {
          //   map.set('mysql', strategy);
          // }
          // Add other else-if blocks for new strategies
        });
        return map;
      },
      // Inject all registered strategy providers into the factory
      inject: [SnowflakeFormsStrategy /*, MySqlFormsStrategy*/],
    },
    
    // Provide the main service
    FormsService,
  ],
  exports: [FormsService], // Export the main service for use in other modules
})
export class FormsModule {} 