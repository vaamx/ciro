import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../utils/logger-factory';
import { OpenAIService } from '../../services/ai/openai.service';
import { QdrantSearchService } from '../../services/vector/search.service';
import { QdrantCollectionService } from '../../services/vector/collection-manager.service';
import { DataSourceType } from '../../types/data-source';
import { db } from '../../config/database';
import { SnowflakeService } from '../../services/data-processing/snowflake/snowflake.service';

const logger = createServiceLogger('AggregationGeneratorService');

@Injectable()
export class AggregationGeneratorService {
  
  
  private constructor(
    private readonly snowflakeService: SnowflakeService,
    private readonly qdrantClientService: QdrantClientService,
    private readonly aggregationGeneratorService: AggregationGeneratorService,
    
    private qdrantSearchService: QdrantSearchService,
    private qdrantCollectionService: QdrantCollectionService,
    private openaiService: OpenAIService,
    private database = db,
    private snowflakeService: SnowflakeService = this.snowflakeService,
  ) {}
  
  
  
  // Common aggregation types to generate
  readonly AGGREGATION_TYPES = [
    'total_sales_by_product',
    'total_quantity_by_product',
    'average_price_by_product',
    'sales_by_category',
    'sales_by_date_range'
  ];
  
  /**
   * Generate aggregations for a data source
   */
  async generateAggregations(
    dataSourceId: number,
    options: GenerateAggregationsOptions = {}
  ): Promise<GeneratedAggregations> {
    logger.info(`Generating aggregations for data source ${dataSourceId}`, { options });
    
    const results: GeneratedAggregations = {
      dataSourceId,
      aggregationsGenerated: 0,
      aggregationsByType: {},
      errors: []
    };
    
    // For each aggregation type
    const aggregationTypes = options.aggregationTypes || this.AGGREGATION_TYPES;
    
    for (const aggType of aggregationTypes) {
      try {
        logger.info(`Generating ${aggType} aggregations for data source ${dataSourceId}`);
        
        const aggregations = await this.generateAggregationByType(
          dataSourceId, 
          aggType, 
          options
        );
        
        results.aggregationsGenerated += aggregations.length;
        results.aggregationsByType[aggType] = aggregations.length;
        
        // Store aggregations
        await this.storeAggregations(aggregations, dataSourceId, aggType, options);
        
        logger.info(`Generated ${aggregations.length} ${aggType} aggregations for data source ${dataSourceId}`);
      } catch (error) {
        logger.error(`Failed to generate ${aggType} aggregations for data source ${dataSourceId}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        
        results.errors.push({
          type: aggType,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    logger.info(`Completed aggregation generation for data source ${dataSourceId}`, {
      aggregationsGenerated: results.aggregationsGenerated,
      errors: results.errors.length
    });
    
    return results;
  }
  
  /**
   * Generate aggregations of a specific type
   */
  private async generateAggregationByType(
    dataSourceId: number,
    aggType: string,
    options: GenerateAggregationsOptions
  ): Promise<Aggregation[]> {
    switch (aggType) {
      case 'total_sales_by_product':
        return this.generateTotalSalesByProduct(dataSourceId, options);
      
      case 'total_quantity_by_product':
        return this.generateTotalQuantityByProduct(dataSourceId, options);
      
      case 'average_price_by_product':
        return this.generateAveragePriceByProduct(dataSourceId, options);
      
      case 'sales_by_category':
        return this.generateSalesByCategory(dataSourceId, options);
      
      case 'sales_by_date_range':
        return this.generateSalesByDateRange(dataSourceId, options);
      
      default:
        throw new Error(`Unknown aggregation type: ${aggType}`);
    }
  }
  
  /**
   * Generate total sales by product aggregations
   */
  private async generateTotalSalesByProduct(
    dataSourceId: number,
    options: GenerateAggregationsOptions
  ): Promise<Aggregation[]> {
    // 1. Get all products
    const products = await this.getProducts(dataSourceId);
    
    // 2. For each product, calculate total sales
    const aggregations: Aggregation[] = [];
    
    for (const product of products) {
      try {
        // Execute full scan aggregation for this product
        const totalSales = await this.calculateTotalSales(
          dataSourceId, 
          product.id, 
          product.name,
          options
        );
        
        // Create aggregation object
        const description = this.createAggregationDescription(
          'total_sales_by_product',
          product,
          totalSales
        );
        
        // Generate embedding
        const vector = await this.openaiService.createEmbeddings(description);
        
        aggregations.push({
          type: 'total_sales_by_product',
          subject: product.name,
          subjectId: product.id,
          value: totalSales,
          description,
          vector: vector[0],
          metadata: {
            dataSourceId,
            product: product.name,
            productId: product.id,
            aggregationType: 'total_sales_by_product',
            lastUpdated: new Date()
          }
        });
      } catch (error) {
        logger.error(`Failed to generate aggregation for product ${product.name}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue with next product
      }
    }
    
    return aggregations;
  }
  
  /**
   * Generate total quantity by product aggregations
   */
  private async generateTotalQuantityByProduct(
    dataSourceId: number,
    options: GenerateAggregationsOptions
  ): Promise<Aggregation[]> {
    try {
      logger.info(`Generating total quantity by product aggregations for data source ${dataSourceId}`);
      
      // 1. Get all products
      const products = await this.getProducts(dataSourceId);
      
      if (products.length === 0) {
        logger.warn(`No products found for data source ${dataSourceId}`);
        return [];
      }
      
      logger.info(`Found ${products.length} products for total quantity aggregation`);
      
      // 2. For each product, calculate total quantity
      const aggregations: Aggregation[] = [];
      
      for (const product of products) {
        try {
          // Calculate total quantity for this product
          const totalQuantity = await this.calculateTotalQuantity(
            dataSourceId, 
            product.id, 
            product.name,
            options
          );
          
          // Create aggregation object
          const description = this.createAggregationDescription(
            'total_quantity_by_product',
            product,
            totalQuantity
          );
          
          // Generate embedding
          const vector = await this.openaiService.createEmbeddings(description);
          
          aggregations.push({
            type: 'total_quantity_by_product',
            subject: product.name,
            subjectId: product.id,
            value: totalQuantity,
            description,
            vector: vector[0],
            metadata: {
              dataSourceId,
              product: product.name,
              productId: product.id,
              aggregationType: 'total_quantity_by_product',
              lastUpdated: new Date()
            }
          });
          
          logger.info(`Generated total quantity aggregation for product ${product.name}: ${totalQuantity}`);
        } catch (error) {
          logger.error(`Failed to generate total quantity aggregation for product ${product.name}`, {
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue with next product
        }
      }
      
      logger.info(`Generated ${aggregations.length} total quantity aggregations`);
      return aggregations;
    } catch (error) {
      logger.error(`Failed to generate total quantity aggregations for data source ${dataSourceId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
  
  /**
   * Calculate total quantity for a product
   */
  private async calculateTotalQuantity(
    dataSourceId: number,
    productId: number | string,
    productName: string,
    options: GenerateAggregationsOptions
  ): Promise<number> {
    try {
      logger.info(`Calculating total quantity for product ${productName} (${productId}) in data source ${dataSourceId}`);
      
      // Get data source details
      const dataSource = await this.database('data_sources')
        .where('id', dataSourceId)
        .first();
      
      if (!dataSource) {
        logger.error(`Data source ${dataSourceId} not found`);
        return 0;
      }
      
      if (dataSource.type === 'snowflake') {
        return this.calculateSnowflakeTotalQuantity(dataSourceId, productId, productName, dataSource, options);
      } else if (dataSource.type === 'file') {
        return this.calculateFileTotalQuantity(dataSourceId, productId, productName, dataSource, options);
      } else {
        logger.warn(`Unsupported data source type: ${dataSource.type}`);
        return 0;
      }
    } catch (error) {
      logger.error(`Error calculating total quantity for product ${productName} (${productId})`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }
  
  /**
   * Calculate total quantity from Snowflake data source
   */
  private async calculateSnowflakeTotalQuantity(
    dataSourceId: number,
    productId: number | string,
    productName: string,
    dataSource: any,
    options: GenerateAggregationsOptions
  ): Promise<number> {
    try {
      // Get data source metadata
      const metadata = dataSource.metadata || {};
      const database = metadata.database;
      const schema = metadata.schema;
      
      if (!database || !schema) {
        logger.error(`Missing database or schema in data source ${dataSourceId} metadata`);
        return 0;
      }
      
      // Get tables
      const tables = await this.snowflakeService.listTables(dataSourceId, database, schema);
      
      // Find sales/orders/inventory table
      const salesTableCandidates = tables.filter(table => 
        table.toLowerCase().includes('sale') || 
        table.toLowerCase().includes('order') ||
        table.toLowerCase().includes('transaction') ||
        table.toLowerCase().includes('inventory')
      );
      
      if (salesTableCandidates.length === 0) {
        logger.warn(`No sales or inventory tables found in data source ${dataSourceId}`);
        return 0;
      }
      
      const salesTable = salesTableCandidates[0];
      logger.info(`Using table: ${salesTable}`);
      
      // Describe the table to understand its structure
      const tableColumns = await this.snowflakeService.describeTable(
        dataSourceId, 
        database, 
        schema, 
        salesTable
      );
      
      // Identify relevant column names
      const productIdFieldName = tableColumns.find(col => 
        col.name.toLowerCase().includes('product_id') || 
        col.name.toLowerCase() === 'product' ||
        col.name.toLowerCase() === 'item_id'
      )?.name || 'product_id';
      
      const quantityFieldName = tableColumns.find(col => 
        col.name.toLowerCase().includes('quantity') ||
        col.name.toLowerCase().includes('qty') ||
        col.name.toLowerCase().includes('units') ||
        col.name.toLowerCase().includes('count')
      )?.name || 'quantity';
      
      // Apply date range filter if provided
      let dateFilter = '';
      if (options.dateRange) {
        const dateColumn = tableColumns.find(col => 
          col.name.toLowerCase().includes('date') ||
          col.name.toLowerCase().includes('time')
        )?.name;
        
        if (dateColumn) {
          const startDate = options.dateRange.start.toISOString().split('T')[0];
          const endDate = options.dateRange.end.toISOString().split('T')[0];
          dateFilter = ` AND ${dateColumn} BETWEEN '${startDate}' AND '${endDate}'`;
        }
      }
      
      // Query for total quantity
      const query = `
        SELECT SUM(${quantityFieldName}) as total_quantity
        FROM ${database}.${schema}.${salesTable}
        WHERE ${productIdFieldName} = '${productId}'${dateFilter}
      `;
      
      logger.info(`Executing query: ${query}`);
      const result = await this.snowflakeService.executeQuery(dataSourceId, query);
      
      if (!result || !result.rows || result.rows.length === 0) {
        logger.warn(`No quantity data found for product ${productName}`);
        return 0;
      }
      
      // Extract total quantity value
      const totalQuantity = result.rows[0][0];
      return typeof totalQuantity === 'number' ? totalQuantity : 0;
    } catch (error) {
      logger.error(`Error calculating Snowflake total quantity for product ${productName}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }
  
  /**
   * Calculate total quantity from file data source
   */
  private async calculateFileTotalQuantity(
    dataSourceId: number,
    productId: number | string,
    productName: string,
    dataSource: any,
    options: GenerateAggregationsOptions
  ): Promise<number> {
    try {
      // For file-based data sources, find a sales/orders/inventory file
      const files = await this.database('uploaded_files')
        .where('data_source_id', dataSourceId)
        .select('id', 'original_name', 'mime_type', 'metadata');
      
      if (!files || files.length === 0) {
        logger.warn(`No files found for data source ${dataSourceId}`);
        return 0;
      }
      
      // Look for sales/inventory data files
      const dataFiles = files.filter(file => 
        (file.mime_type === 'application/json' || 
         file.mime_type === 'text/csv') &&
        (file.original_name.toLowerCase().includes('sale') ||
         file.original_name.toLowerCase().includes('order') ||
         file.original_name.toLowerCase().includes('transaction') ||
         file.original_name.toLowerCase().includes('inventory'))
      );
      
      if (dataFiles.length === 0) {
        logger.warn(`No relevant data files found for data source ${dataSourceId}`);
        return 0;
      }
      
      const file = dataFiles[0];
      logger.info(`Using file: ${file.original_name}`);
      
      // Process file metadata preview if available
      if (file.metadata && file.metadata.preview && Array.isArray(file.metadata.preview)) {
        const preview = file.metadata.preview;
        
        if (preview.length < 2) {
          return 0;
        }
        
        // First row is headers
        const headers = preview[0];
        
        // Find column indexes
        const productIdIndex = headers.findIndex((header: string) => 
          header.toLowerCase().includes('product_id') || 
          header.toLowerCase() === 'product' ||
          header.toLowerCase() === 'item_id'
        );
        
        const quantityIndex = headers.findIndex((header: string) => 
          header.toLowerCase().includes('quantity') ||
          header.toLowerCase().includes('qty') ||
          header.toLowerCase().includes('units') ||
          header.toLowerCase().includes('count')
        );
        
        if (productIdIndex < 0 || quantityIndex < 0) {
          logger.warn(`Required columns not found in file ${file.original_name}`);
          return 0;
        }
        
        // Find the records for this product and sum up quantities
        let totalQuantity = 0;
        
        for (let i = 1; i < preview.length; i++) {
          const row = preview[i];
          if (row[productIdIndex] == productId) { // Use loose equality to match string/number IDs
            const quantity = parseInt(row[quantityIndex], 10);
            if (!isNaN(quantity)) {
              totalQuantity += quantity;
            }
          }
        }
        
        return totalQuantity;
      }
      
      logger.warn(`No preview data available for file ${file.id}`);
      return 0;
    } catch (error) {
      logger.error(`Error calculating file total quantity for product ${productName}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }
  
  /**
   * Generate average price by product aggregations
   */
  private async generateAveragePriceByProduct(
    dataSourceId: number,
    options: GenerateAggregationsOptions
  ): Promise<Aggregation[]> {
    try {
      logger.info(`Generating average price by product aggregations for data source ${dataSourceId}`);
      
      // 1. Get all products
      const products = await this.getProducts(dataSourceId);
      
      if (products.length === 0) {
        logger.warn(`No products found for data source ${dataSourceId}`);
        return [];
      }
      
      logger.info(`Found ${products.length} products for average price aggregation`);
      
      // 2. For each product, calculate average price
      const aggregations: Aggregation[] = [];
      
      for (const product of products) {
        try {
          // Calculate average price for this product
          const averagePrice = await this.calculateAveragePrice(
            dataSourceId, 
            product.id, 
            product.name,
            options
          );
          
          // Create aggregation object
          const description = this.createAggregationDescription(
            'average_price_by_product',
            product,
            averagePrice
          );
          
          // Generate embedding
          const vector = await this.openaiService.createEmbeddings(description);
          
          aggregations.push({
            type: 'average_price_by_product',
            subject: product.name,
            subjectId: product.id,
            value: averagePrice,
            description,
            vector: vector[0],
            metadata: {
              dataSourceId,
              product: product.name,
              productId: product.id,
              aggregationType: 'average_price_by_product',
              lastUpdated: new Date()
            }
          });
          
          logger.info(`Generated average price aggregation for product ${product.name}: ${averagePrice.toFixed(2)}`);
        } catch (error) {
          logger.error(`Failed to generate average price aggregation for product ${product.name}`, {
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue with next product
        }
      }
      
      logger.info(`Generated ${aggregations.length} average price aggregations`);
      return aggregations;
    } catch (error) {
      logger.error(`Failed to generate average price aggregations for data source ${dataSourceId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
  
  /**
   * Calculate average price for a product
   */
  private async calculateAveragePrice(
    dataSourceId: number,
    productId: number | string,
    productName: string,
    options: GenerateAggregationsOptions
  ): Promise<number> {
    try {
      logger.info(`Calculating average price for product ${productName} (${productId}) in data source ${dataSourceId}`);
      
      // Get data source details
      const dataSource = await this.database('data_sources')
        .where('id', dataSourceId)
        .first();
      
      if (!dataSource) {
        logger.error(`Data source ${dataSourceId} not found`);
        return 0;
      }
      
      if (dataSource.type === 'snowflake') {
        return this.calculateSnowflakeAveragePrice(dataSourceId, productId, productName, dataSource, options);
      } else if (dataSource.type === 'file') {
        return this.calculateFileAveragePrice(dataSourceId, productId, productName, dataSource, options);
      } else {
        logger.warn(`Unsupported data source type: ${dataSource.type}`);
        return 0;
      }
    } catch (error) {
      logger.error(`Error calculating average price for product ${productName} (${productId})`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }
  
  /**
   * Calculate average price from Snowflake data source
   */
  private async calculateSnowflakeAveragePrice(
    dataSourceId: number,
    productId: number | string,
    productName: string,
    dataSource: any,
    options: GenerateAggregationsOptions
  ): Promise<number> {
    try {
      // Get data source metadata
      const metadata = dataSource.metadata || {};
      const database = metadata.database;
      const schema = metadata.schema;
      
      if (!database || !schema) {
        logger.error(`Missing database or schema in data source ${dataSourceId} metadata`);
        return 0;
      }
      
      // Get tables
      const tables = await this.snowflakeService.listTables(dataSourceId, database, schema);
      
      // Try to find a products table first for direct price information
      const productTableCandidates = tables.filter(table => 
        table.toLowerCase().includes('product') ||
        table.toLowerCase().includes('item') ||
        table.toLowerCase().includes('catalog')
      );
      
      if (productTableCandidates.length > 0) {
        // We found a products table, try to get price from there
        const productTable = productTableCandidates[0];
        logger.info(`Using product table: ${productTable} for price information`);
        
        const tableColumns = await this.snowflakeService.describeTable(
          dataSourceId, 
          database, 
          schema, 
          productTable
        );
        
        const priceColumnName = tableColumns.find(col => 
          col.name.toLowerCase().includes('price') ||
          col.name.toLowerCase().includes('cost') ||
          col.name.toLowerCase().includes('amount') ||
          col.name.toLowerCase().includes('value')
        )?.name;
        
        if (priceColumnName) {
          const productIdFieldName = tableColumns.find(col => 
            col.name.toLowerCase() === 'id' ||
            col.name.toLowerCase().includes('product_id')
          )?.name || 'id';
          
          // Query for product price
          const query = `
            SELECT ${priceColumnName}
            FROM ${database}.${schema}.${productTable}
            WHERE ${productIdFieldName} = '${productId}'
          `;
          
          logger.info(`Executing query: ${query}`);
          const result = await this.snowflakeService.executeQuery(dataSourceId, query);
          
          if (result?.rows?.length > 0 && result.rows[0][0] !== null) {
            const price = parseFloat(result.rows[0][0]);
            if (!isNaN(price)) {
              return price;
            }
          }
        }
      }
      
      // If we couldn't get price from product table, try sales/orders
      const salesTableCandidates = tables.filter(table => 
        table.toLowerCase().includes('sale') || 
        table.toLowerCase().includes('order') ||
        table.toLowerCase().includes('transaction')
      );
      
      if (salesTableCandidates.length === 0) {
        logger.warn(`No sales or product tables found with price information in data source ${dataSourceId}`);
        return 0;
      }
      
      const salesTable = salesTableCandidates[0];
      logger.info(`Using sales table: ${salesTable} for average price calculation`);
      
      // Describe the table to understand its structure
      const tableColumns = await this.snowflakeService.describeTable(
        dataSourceId, 
        database, 
        schema, 
        salesTable
      );
      
      // Identify relevant column names
      const productIdFieldName = tableColumns.find(col => 
        col.name.toLowerCase().includes('product_id') || 
        col.name.toLowerCase() === 'product' ||
        col.name.toLowerCase() === 'item_id'
      )?.name || 'product_id';
      
      // Try to find unit price or calculate from total/quantity
      const unitPriceFieldName = tableColumns.find(col => 
        col.name.toLowerCase().includes('unit_price') ||
        col.name.toLowerCase().includes('price') ||
        col.name.toLowerCase() === 'rate'
      )?.name;
      
      let query;
      
      if (unitPriceFieldName) {
        // If we have a unit price column, use AVG directly
        query = `
          SELECT AVG(${unitPriceFieldName}) as average_price
          FROM ${database}.${schema}.${salesTable}
          WHERE ${productIdFieldName} = '${productId}'
        `;
      } else {
        // Otherwise try to calculate from total and quantity
        const totalFieldName = tableColumns.find(col => 
          col.name.toLowerCase().includes('total') ||
          col.name.toLowerCase().includes('amount') ||
          col.name.toLowerCase().includes('value')
        )?.name || 'total';
        
        const quantityFieldName = tableColumns.find(col => 
          col.name.toLowerCase().includes('quantity') ||
          col.name.toLowerCase().includes('qty') ||
          col.name.toLowerCase().includes('units')
        )?.name || 'quantity';
        
        query = `
          SELECT AVG(${totalFieldName} / NULLIF(${quantityFieldName}, 0)) as average_price
          FROM ${database}.${schema}.${salesTable}
          WHERE ${productIdFieldName} = '${productId}'
        `;
      }
      
      logger.info(`Executing query: ${query}`);
      const result = await this.snowflakeService.executeQuery(dataSourceId, query);
      
      if (!result || !result.rows || result.rows.length === 0) {
        logger.warn(`No price data found for product ${productName}`);
        return 0;
      }
      
      // Extract average price value
      const averagePrice = result.rows[0][0];
      return typeof averagePrice === 'number' ? averagePrice : 0;
    } catch (error) {
      logger.error(`Error calculating Snowflake average price for product ${productName}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }
  
  /**
   * Calculate average price from file data source
   */
  private async calculateFileAveragePrice(
    dataSourceId: number,
    productId: number | string,
    productName: string,
    dataSource: any,
    options: GenerateAggregationsOptions
  ): Promise<number> {
    try {
      // For file-based data sources, first look for a products file
      const files = await this.database('uploaded_files')
        .where('data_source_id', dataSourceId)
        .select('id', 'original_name', 'mime_type', 'metadata');
      
      if (!files || files.length === 0) {
        logger.warn(`No files found for data source ${dataSourceId}`);
        return 0;
      }
      
      // First try to find a product catalog file
      const productFiles = files.filter(file => 
        (file.mime_type === 'application/json' || 
         file.mime_type === 'text/csv') &&
        (file.original_name.toLowerCase().includes('product') ||
         file.original_name.toLowerCase().includes('catalog') ||
         file.original_name.toLowerCase().includes('item'))
      );
      
      // If we find a product file, try to get the price directly
      if (productFiles.length > 0) {
        const file = productFiles[0];
        logger.info(`Using product file: ${file.original_name} for price information`);
        
        if (file.metadata?.preview && Array.isArray(file.metadata.preview)) {
          const preview = file.metadata.preview;
          
          if (preview.length < 2) {
            logger.warn(`Not enough data in product file preview`);
          } else {
            // First row is headers
            const headers = preview[0];
            
            // Find column indexes
            const productIdIndex = headers.findIndex((header: string) => 
              header.toLowerCase() === 'id' ||
              header.toLowerCase().includes('product_id')
            );
            
            const priceIndex = headers.findIndex((header: string) => 
              header.toLowerCase().includes('price') ||
              header.toLowerCase().includes('cost') ||
              header.toLowerCase().includes('rate')
            );
            
            if (productIdIndex >= 0 && priceIndex >= 0) {
              // Look for this product's entry
              for (let i = 1; i < preview.length; i++) {
                const row = preview[i];
                if (row[productIdIndex] == productId) { // Use loose equality to match string/number IDs
                  const price = parseFloat(row[priceIndex]);
                  if (!isNaN(price)) {
                    return price;
                  }
                }
              }
            }
          }
        }
      }
      
      // If we couldn't get price from product file, try sales/transactions data
      const salesFiles = files.filter(file => 
        (file.mime_type === 'application/json' || 
         file.mime_type === 'text/csv') &&
        (file.original_name.toLowerCase().includes('sale') ||
         file.original_name.toLowerCase().includes('order') ||
         file.original_name.toLowerCase().includes('transaction'))
      );
      
      if (salesFiles.length === 0) {
        logger.warn(`No sales files found for data source ${dataSourceId}`);
        return 0;
      }
      
      const file = salesFiles[0];
      logger.info(`Using file: ${file.original_name} for average price calculation`);
      
      // Process file metadata preview if available
      if (file.metadata?.preview && Array.isArray(file.metadata.preview)) {
        const preview = file.metadata.preview;
        
        if (preview.length < 2) {
          return 0;
        }
        
        // First row is headers
        const headers = preview[0];
        
        // Find column indexes
        const productIdIndex = headers.findIndex((header: string) => 
          header.toLowerCase().includes('product_id') || 
          header.toLowerCase() === 'product' ||
          header.toLowerCase() === 'item_id'
        );
        
        // Try to find unit price column first
        let unitPriceIndex = headers.findIndex((header: string) => 
          header.toLowerCase().includes('unit_price') ||
          header.toLowerCase() === 'price' ||
          header.toLowerCase() === 'rate'
        );
        
        // If no unit price, we'll need total and quantity
        const totalIndex = unitPriceIndex < 0 ? headers.findIndex((header: string) => 
          header.toLowerCase().includes('total') ||
          header.toLowerCase().includes('amount') ||
          header.toLowerCase().includes('value')
        ) : -1;
        
        const quantityIndex = unitPriceIndex < 0 ? headers.findIndex((header: string) => 
          header.toLowerCase().includes('quantity') ||
          header.toLowerCase().includes('qty') ||
          header.toLowerCase().includes('units')
        ) : -1;
        
        // Verify we have needed columns
        if (productIdIndex < 0 || (unitPriceIndex < 0 && (totalIndex < 0 || quantityIndex < 0))) {
          logger.warn(`Required columns not found in file ${file.original_name}`);
          return 0;
        }
        
        // Calculate average price
        let totalPriceSum = 0;
        let transactionCount = 0;
        
        for (let i = 1; i < preview.length; i++) {
          const row = preview[i];
          if (row[productIdIndex] == productId) { // Use loose equality to match string/number IDs
            if (unitPriceIndex >= 0) {
              // If we have unit price, use it directly
              const price = parseFloat(row[unitPriceIndex]);
              if (!isNaN(price)) {
                totalPriceSum += price;
                transactionCount++;
              }
            } else {
              // Otherwise calculate from total/quantity
              const total = parseFloat(row[totalIndex]);
              const quantity = parseFloat(row[quantityIndex]);
              if (!isNaN(total) && !isNaN(quantity) && quantity > 0) {
                const unitPrice = total / quantity;
                totalPriceSum += unitPrice;
                transactionCount++;
              }
            }
          }
        }
        
        return transactionCount > 0 ? totalPriceSum / transactionCount : 0;
      }
      
      logger.warn(`No preview data available for file ${file.id}`);
      return 0;
    } catch (error) {
      logger.error(`Error calculating file average price for product ${productName}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }
  
  /**
   * Generate sales by category aggregations
   */
  private async generateSalesByCategory(
    dataSourceId: number,
    options: GenerateAggregationsOptions
  ): Promise<Aggregation[]> {
    return [];
  }
  
  /**
   * Generate sales by date range aggregations
   */
  private async generateSalesByDateRange(
    dataSourceId: number,
    options: GenerateAggregationsOptions
  ): Promise<Aggregation[]> {
    return [];
  }
  
  /**
   * Store aggregations in vector database
   */
  private async storeAggregations(
    aggregations: Aggregation[],
    dataSourceId: number,
    aggType: string,
    options: GenerateAggregationsOptions
  ): Promise<void> {
    if (aggregations.length === 0) {
      logger.info(`No aggregations to store for type ${aggType}`);
      return;
    }
    
    logger.info(`Storing ${aggregations.length} aggregations for type ${aggType}`);
    
    // Store in vector database
    const points = aggregations.map((agg, index) => ({
      id: `aggregation:${dataSourceId}:${aggType}:${agg.subjectId || index}`,
      vector: agg.vector,
      payload: {
        text: agg.description,
        type: 'aggregation',
        aggregationType: aggType,
        subject: agg.subject,
        subjectId: agg.subjectId,
        value: agg.value,
        dataSourceId,
        lastUpdated: new Date()
      }
    }));
    
    // Ensure collection exists
    const collectionName = `datasource_${dataSourceId}_aggregations`;
    const collectionExists = await this.qdrantCollectionService.collectionExists(collectionName);
    
    if (!collectionExists) {
      await this.qdrantCollectionService.createCollection(collectionName, {
        vectors: {
          size: 1536, // OpenAI embedding dimension
          distance: 'Cosine'
        }
      });
    }
    
    // Upsert to collection - need to import QdrantClientService for this
    const { QdrantClientService } = await import('../../services/vector/qdrant-client.service');
    const client = this.qdrantClientService.getClient();
    await client.upsert(collectionName, {
      points
    });
    
    logger.info(`Successfully stored ${points.length} aggregation points in collection ${collectionName}`);
  }
  
  /**
   * Get products for a data source
   */
  private async getProducts(dataSourceId: number): Promise<Product[]> {
    try {
      logger.info(`Fetching products for data source ${dataSourceId}`);
      
      // Get data source details
      const dataSource = await this.database('data_sources')
        .where('id', dataSourceId)
        .first();
      
      if (!dataSource) {
        logger.error(`Data source ${dataSourceId} not found`);
        return [];
      }
      
      logger.info(`Data source type: ${dataSource.type}`);
      
      if (dataSource.type === 'snowflake') {
        return this.getSnowflakeProducts(dataSourceId, dataSource);
      } else if (dataSource.type === 'file') {
        return this.getFileProducts(dataSourceId, dataSource);
      } else {
        logger.warn(`Unsupported data source type: ${dataSource.type}`);
        return [];
      }
    } catch (error) {
      logger.error(`Error fetching products for data source ${dataSourceId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
  
  /**
   * Get products from a Snowflake data source
   */
  private async getSnowflakeProducts(dataSourceId: number, dataSource: any): Promise<Product[]> {
    try {
      // Get data source metadata to find product table details
      const metadata = dataSource.metadata || {};
      const database = metadata.database;
      const schema = metadata.schema;
      
      if (!database || !schema) {
        logger.error(`Missing database or schema in data source ${dataSourceId} metadata`);
        return [];
      }
      
      // Get available tables
      const tables = await this.snowflakeService.listTables(dataSourceId, database, schema);
      
      // Find a likely products table - in a real implementation, this would be more sophisticated 
      // or configured specifically for the data source
      const productTableCandidates = tables.filter(table => 
        table.toLowerCase().includes('product') || 
        table.toLowerCase().includes('item') ||
        table.toLowerCase().includes('sku')
      );
      
      if (productTableCandidates.length === 0) {
        logger.warn(`No product tables found in data source ${dataSourceId}`);
        return [];
      }
      
      const productTable = productTableCandidates[0];
      logger.info(`Using product table: ${productTable}`);
      
      // Query for products
      const query = `
        SELECT id, name, category 
        FROM ${database}.${schema}.${productTable}
        LIMIT 100
      `;
      
      const result = await this.snowflakeService.executeQuery(dataSourceId, query);
      
      if (!result || !result.rows || result.rows.length === 0) {
        logger.warn(`No products found in table ${productTable}`);
        return [];
      }
      
      // Parse the results into Product objects
      return result.rows.map(row => {
        // Find column indexes 
        const idIndex = result.columns.findIndex(col => 
          col.toLowerCase() === 'id' || col.toLowerCase().includes('_id')
        );
        
        const nameIndex = result.columns.findIndex(col => 
          col.toLowerCase() === 'name' || 
          col.toLowerCase().includes('product_name') ||
          col.toLowerCase().includes('item_name')
        );
        
        const categoryIndex = result.columns.findIndex(col => 
          col.toLowerCase() === 'category' || 
          col.toLowerCase().includes('category_name') ||
          col.toLowerCase().includes('product_category')
        );
        
        // Extract values, handling potential missing columns
        const id = idIndex >= 0 ? row[idIndex] : null;
        const name = nameIndex >= 0 ? row[nameIndex] : 'Unknown Product';
        const category = categoryIndex >= 0 ? row[categoryIndex] : undefined;
        
        return { id, name, category };
      }).filter(product => product.id !== null); // Filter out products with no ID
    } catch (error) {
      logger.error(`Error fetching Snowflake products for data source ${dataSourceId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return empty array in case of error
      return [];
    }
  }
  
  /**
   * Get products from a file-based data source
   */
  private async getFileProducts(dataSourceId: number, dataSource: any): Promise<Product[]> {
    try {
      // For file-based data sources, query the database for file contents
      const files = await this.database('uploaded_files')
        .where('data_source_id', dataSourceId)
        .select('id', 'original_name', 'mime_type', 'metadata');
      
      if (!files || files.length === 0) {
        logger.warn(`No files found for data source ${dataSourceId}`);
        return [];
      }
      
      // Look for JSON or CSV files that might contain product data
      const productFiles = files.filter(file => 
        (file.mime_type === 'application/json' || 
         file.mime_type === 'text/csv') &&
        (file.original_name.toLowerCase().includes('product') ||
         file.original_name.toLowerCase().includes('item'))
      );
      
      if (productFiles.length === 0) {
        logger.warn(`No product files found for data source ${dataSourceId}`);
        return [];
      }
      
      const file = productFiles[0];
      logger.info(`Using file: ${file.original_name}`);
      
      // In a real implementation, you would parse file contents from storage
      // For now, use metadata if available
      if (file.metadata && file.metadata.preview && Array.isArray(file.metadata.preview)) {
        // Assume preview data has headers and rows
        const preview = file.metadata.preview;
        if (preview.length < 2) {
          return [];
        }
        
        // First row is headers
        const headers = preview[0];
        
        // Find column indexes
        const idIndex = headers.findIndex((header: string) => 
          header.toLowerCase() === 'id' || header.toLowerCase().includes('_id')
        );
        
        const nameIndex = headers.findIndex((header: string) => 
          header.toLowerCase() === 'name' || 
          header.toLowerCase().includes('product_name') ||
          header.toLowerCase().includes('item_name')
        );
        
        const categoryIndex = headers.findIndex((header: string) => 
          header.toLowerCase() === 'category' || 
          header.toLowerCase().includes('category_name') ||
          header.toLowerCase().includes('product_category')
        );
        
        // Extract products from rows
        return preview.slice(1).map((row: any[]) => {
          const id = idIndex >= 0 ? row[idIndex] : null;
          const name = nameIndex >= 0 ? row[nameIndex] : 'Unknown Product';
          const category = categoryIndex >= 0 ? row[categoryIndex] : undefined;
          
          return { id, name, category };
        }).filter((product: Product) => product.id !== null);
      }
      
      logger.warn(`No preview data available for file ${file.id}`);
      return [];
    } catch (error) {
      logger.error(`Error fetching file products for data source ${dataSourceId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return empty array in case of error
      return [];
    }
  }
  
  /**
   * Calculate total sales for a product
   */
  private async calculateTotalSales(
    dataSourceId: number,
    productId: number | string,
    productName: string,
    options: GenerateAggregationsOptions
  ): Promise<number> {
    try {
      logger.info(`Calculating total sales for product ${productName} (${productId}) in data source ${dataSourceId}`);
      
      // Get data source details
      const dataSource = await this.database('data_sources')
        .where('id', dataSourceId)
        .first();
      
      if (!dataSource) {
        logger.error(`Data source ${dataSourceId} not found`);
        return 0;
      }
      
      if (dataSource.type === 'snowflake') {
        return this.calculateSnowflakeTotalSales(dataSourceId, productId, productName, dataSource, options);
      } else if (dataSource.type === 'file') {
        return this.calculateFileTotalSales(dataSourceId, productId, productName, dataSource, options);
      } else {
        logger.warn(`Unsupported data source type: ${dataSource.type}`);
        return 0;
      }
    } catch (error) {
      logger.error(`Error calculating total sales for product ${productName} (${productId})`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }
  
  /**
   * Calculate total sales from Snowflake data source
   */
  private async calculateSnowflakeTotalSales(
    dataSourceId: number,
    productId: number | string,
    productName: string,
    dataSource: any,
    options: GenerateAggregationsOptions
  ): Promise<number> {
    try {
      // Get data source metadata
      const metadata = dataSource.metadata || {};
      const database = metadata.database;
      const schema = metadata.schema;
      
      if (!database || !schema) {
        logger.error(`Missing database or schema in data source ${dataSourceId} metadata`);
        return 0;
      }
      
      // Get tables
      const tables = await this.snowflakeService.listTables(dataSourceId, database, schema);
      
      // Find sales/orders table
      const salesTableCandidates = tables.filter(table => 
        table.toLowerCase().includes('sale') || 
        table.toLowerCase().includes('order') ||
        table.toLowerCase().includes('transaction')
      );
      
      if (salesTableCandidates.length === 0) {
        logger.warn(`No sales tables found in data source ${dataSourceId}`);
        return 0;
      }
      
      const salesTable = salesTableCandidates[0];
      logger.info(`Using sales table: ${salesTable}`);
      
      // Describe the table to understand its structure
      const tableColumns = await this.snowflakeService.describeTable(
        dataSourceId, 
        database, 
        schema, 
        salesTable
      );
      
      // Identify relevant column names
      const hasProductIdColumn = tableColumns.some(col => 
        col.name.toLowerCase().includes('product_id') || 
        col.name.toLowerCase() === 'product' ||
        col.name.toLowerCase() === 'item_id'
      );
      
      const productIdFieldName = tableColumns.find(col => 
        col.name.toLowerCase().includes('product_id') || 
        col.name.toLowerCase() === 'product' ||
        col.name.toLowerCase() === 'item_id'
      )?.name || 'product_id';
      
      const totalFieldName = tableColumns.find(col => 
        col.name.toLowerCase().includes('total') ||
        col.name.toLowerCase().includes('amount') ||
        col.name.toLowerCase().includes('value') ||
        col.name.toLowerCase().includes('price')
      )?.name || 'total';
      
      if (!hasProductIdColumn) {
        logger.warn(`No product ID column found in sales table ${salesTable}`);
        return 0;
      }
      
      // Apply date range filter if provided
      let dateFilter = '';
      if (options.dateRange) {
        const dateColumn = tableColumns.find(col => 
          col.name.toLowerCase().includes('date') ||
          col.name.toLowerCase().includes('time')
        )?.name;
        
        if (dateColumn) {
          const startDate = options.dateRange.start.toISOString().split('T')[0];
          const endDate = options.dateRange.end.toISOString().split('T')[0];
          dateFilter = ` AND ${dateColumn} BETWEEN '${startDate}' AND '${endDate}'`;
        }
      }
      
      // Query for total sales
      const query = `
        SELECT SUM(${totalFieldName}) as total_sales
        FROM ${database}.${schema}.${salesTable}
        WHERE ${productIdFieldName} = '${productId}'${dateFilter}
      `;
      
      logger.info(`Executing query: ${query}`);
      const result = await this.snowflakeService.executeQuery(dataSourceId, query);
      
      if (!result || !result.rows || result.rows.length === 0) {
        logger.warn(`No sales data found for product ${productName}`);
        return 0;
      }
      
      // Extract total sales value
      const totalSales = result.rows[0][0];
      return typeof totalSales === 'number' ? totalSales : 0;
    } catch (error) {
      logger.error(`Error calculating Snowflake total sales for product ${productName}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }
  
  /**
   * Calculate total sales from file data source
   */
  private async calculateFileTotalSales(
    dataSourceId: number,
    productId: number | string,
    productName: string,
    dataSource: any,
    options: GenerateAggregationsOptions
  ): Promise<number> {
    try {
      // For file-based data sources, find a sales/orders file
      const files = await this.database('uploaded_files')
        .where('data_source_id', dataSourceId)
        .select('id', 'original_name', 'mime_type', 'metadata');
      
      if (!files || files.length === 0) {
        logger.warn(`No files found for data source ${dataSourceId}`);
        return 0;
      }
      
      // Look for sales data files
      const salesFiles = files.filter(file => 
        (file.mime_type === 'application/json' || 
         file.mime_type === 'text/csv') &&
        (file.original_name.toLowerCase().includes('sale') ||
         file.original_name.toLowerCase().includes('order') ||
         file.original_name.toLowerCase().includes('transaction'))
      );
      
      if (salesFiles.length === 0) {
        logger.warn(`No sales files found for data source ${dataSourceId}`);
        return 0;
      }
      
      const file = salesFiles[0];
      logger.info(`Using file: ${file.original_name}`);
      
      // Process file metadata preview if available
      if (file.metadata && file.metadata.preview && Array.isArray(file.metadata.preview)) {
        const preview = file.metadata.preview;
        
        if (preview.length < 2) {
          return 0;
        }
        
        // First row is headers
        const headers = preview[0];
        
        // Find column indexes
        const productIdIndex = headers.findIndex((header: string) => 
          header.toLowerCase().includes('product_id') || 
          header.toLowerCase() === 'product' ||
          header.toLowerCase() === 'item_id'
        );
        
        const amountIndex = headers.findIndex((header: string) => 
          header.toLowerCase().includes('total') ||
          header.toLowerCase().includes('amount') ||
          header.toLowerCase().includes('price') ||
          header.toLowerCase().includes('value')
        );
        
        if (productIdIndex < 0 || amountIndex < 0) {
          logger.warn(`Required columns not found in file ${file.original_name}`);
          return 0;
        }
        
        // Find the transactions for this product and sum up
        let totalSales = 0;
        
        for (let i = 1; i < preview.length; i++) {
          const row = preview[i];
          if (row[productIdIndex] == productId) { // Use loose equality to match string/number IDs
            const amount = parseFloat(row[amountIndex]);
            if (!isNaN(amount)) {
              totalSales += amount;
            }
          }
        }
        
        return totalSales;
      }
      
      logger.warn(`No preview data available for file ${file.id}`);
      return 0;
    } catch (error) {
      logger.error(`Error calculating file total sales for product ${productName}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }
  
  /**
   * Create a text description for an aggregation
   */
  private createAggregationDescription(
    aggType: string,
    product: Product,
    value: number
  ): string {
    switch (aggType) {
      case 'total_sales_by_product':
        return `Total sales for product ${product.name} (ID: ${product.id}) is $${value.toFixed(2)}. This represents the sum of all sales transactions for this specific product.`;
      
      case 'total_quantity_by_product':
        return `Total quantity sold for product ${product.name} (ID: ${product.id}) is ${value} units. This represents the sum of all units sold for this specific product.`;
      
      case 'average_price_by_product':
        return `Average price for product ${product.name} (ID: ${product.id}) is $${value.toFixed(2)}. This represents the average price across all sales transactions for this product.`;
      
      default:
        return `${aggType} for ${product.name} (ID: ${product.id}): ${value}`;
    }
  }
}

interface GenerateAggregationsOptions {
  aggregationTypes?: string[];
  forceRefresh?: boolean;
  collection?: string;
  fieldMapping?: Record<string, string>;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

interface GeneratedAggregations {
  dataSourceId: number;
  aggregationsGenerated: number;
  aggregationsByType: Record<string, number>;
  errors: {type: string, error: string}[];
}

interface Aggregation {
  type: string;
  subject: string;
  subjectId?: number | string;
  value: number;
  description: string;
  vector: number[];
  metadata: any;
}

interface Product {
  id: number | string;
  name: string;
  category?: string;
}

// Export singleton instance
export const aggregationGeneratorService = this.aggregationGeneratorService; 