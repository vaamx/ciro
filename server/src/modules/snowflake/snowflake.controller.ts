import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Logger,
  HttpCode,
  ParseIntPipe,
  Injectable,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SnowflakeService } from './snowflake.service';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { GetUser } from '../../core/auth/get-user.decorator';
import { User } from '../../core/database/prisma-types';
import { TestConnectionDto, ExecuteQueryDto, NaturalLanguageQueryDto } from './dto';

@ApiTags('snowflake')
@Controller('snowflake')
@UseGuards(JwtAuthGuard)
@Injectable()
export class SnowflakeController {
  constructor(
    private readonly snowflakeService: SnowflakeService,
    private readonly logger: Logger
  ) {
    // Instead of using setContext, we'll pass context string to each log call
  }

  @Post('test-connection')
  @HttpCode(200)
  async testConnection(@Body() testConnectionDto: TestConnectionDto, @GetUser() user: User) {
    this.logger.log(`Testing Snowflake connection for user: ${user.id}`, 'SnowflakeController');
    return await this.snowflakeService.testConnection(testConnectionDto);
  }

  @Get(':id/databases')
  async listDatabases(@Param('id', ParseIntPipe) id: number, @GetUser() user: User) {
    this.logger.log(`Listing databases for data source ID: ${id}, user: ${user.id}`, 'SnowflakeController');
    return await this.snowflakeService.listDatabases(id);
  }

  @Get(':id/databases/:database/schemas')
  async listSchemas(
    @Param('id', ParseIntPipe) id: number,
    @Param('database') database: string,
    @GetUser() user: User
  ) {
    this.logger.log(`Listing schemas for data source ID: ${id}, database: ${database}, user: ${user.id}`, 'SnowflakeController');
    return await this.snowflakeService.listSchemas(id, database);
  }

  @Get(':id/databases/:database/schemas/:schema/tables')
  async listTables(
    @Param('id', ParseIntPipe) id: number,
    @Param('database') database: string, 
    @Param('schema') schema: string,
    @GetUser() user: User
  ) {
    this.logger.log(`Listing tables for data source ID: ${id}, database: ${database}, schema: ${schema}, user: ${user.id}`, 'SnowflakeController');
    return await this.snowflakeService.listTables(id, database, schema);
  }

  @Get(':id/databases/:database/schemas/:schema/tables/:table')
  async describeTable(
    @Param('id', ParseIntPipe) id: number,
    @Param('database') database: string,
    @Param('schema') schema: string,
    @Param('table') table: string,
    @GetUser() user: User
  ) {
    this.logger.log(`Describing table for data source ID: ${id}, table: ${database}.${schema}.${table}, user: ${user.id}`, 'SnowflakeController');
    return await this.snowflakeService.describeTable(id, database, schema, table);
  }

  @Post(':id/execute')
  @HttpCode(200)
  async executeQuery(
    @Param('id', ParseIntPipe) id: number,
    @Body() executeQueryDto: ExecuteQueryDto,
    @GetUser() user: User
  ) {
    this.logger.log(`Executing query for data source ID: ${id}, user: ${user.id}`, 'SnowflakeController');
    return await this.snowflakeService.executeQuery(id, executeQueryDto.query);
  }

  @Post(':id/nl-query')
  @HttpCode(200)
  async executeNaturalLanguageQuery(
    @Param('id', ParseIntPipe) id: number,
    @Body() nlQueryDto: NaturalLanguageQueryDto,
    @GetUser() user: User
  ) {
    this.logger.log(`Executing natural language query for data source ID: ${id}, user: ${user.id}`, 'SnowflakeController');
    return await this.snowflakeService.executeNaturalLanguageQuery(
      id,
      nlQueryDto.query,
      nlQueryDto.options
    );
  }
} 