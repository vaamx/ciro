import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { MeterReadingsService } from './meter-readings.service';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { UpdateMeterReadingDto } from './dto/update-meter-reading.dto';
import { BulkMeterReadingImportDto } from './dto/bulk-import.dto';
import { RequireClientTenantAccess, RequireAuthAndPermissions } from '../../core/auth';
import { PERMISSIONS } from '../../core/auth/jwt.strategy';
import { ReadingType } from '@prisma/client';

@ApiTags('Meter Readings')
@ApiBearerAuth()
@Controller('meter-readings')
@RequireClientTenantAccess()
export class MeterReadingsController {
  constructor(private readonly meterReadingsService: MeterReadingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new meter reading' })
  @ApiResponse({ status: 201, description: 'Meter reading created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Duplicate meter reading' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  create(@Body(ValidationPipe) createMeterReadingDto: CreateMeterReadingDto) {
    return this.meterReadingsService.create(createMeterReadingDto);
  }

  @Post('bulk-import')
  @ApiOperation({ summary: 'Bulk import meter readings' })
  @ApiResponse({ status: 201, description: 'Bulk import completed' })
  @ApiResponse({ status: 400, description: 'Invalid bulk import data' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  bulkImport(@Body(ValidationPipe) bulkImportDto: BulkMeterReadingImportDto) {
    return this.meterReadingsService.bulkImport(bulkImportDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all meter readings with optional filters' })
  @ApiResponse({ status: 200, description: 'Meter readings retrieved successfully' })
  @ApiQuery({ name: 'customerId', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'readingType', required: false, enum: ReadingType })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  findAll(
    @Query('customerId', new ParseIntPipe({ optional: true })) customerId?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('readingType') readingType?: ReadingType,
  ) {
    return this.meterReadingsService.findAll(customerId, startDate, endDate, readingType);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get meter reading statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiQuery({ name: 'customerId', required: false, type: Number })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  getStats(@Query('customerId', new ParseIntPipe({ optional: true })) customerId?: number) {
    return this.meterReadingsService.getReadingStats(customerId);
  }

  @Get('customer/:customerId')
  @ApiOperation({ summary: 'Get meter readings for a specific customer' })
  @ApiResponse({ status: 200, description: 'Customer meter readings retrieved successfully' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  getCustomerReadings(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.meterReadingsService.getCustomerReadings(customerId, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific meter reading by ID' })
  @ApiResponse({ status: 200, description: 'Meter reading retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Meter reading not found' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.meterReadingsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a meter reading' })
  @ApiResponse({ status: 200, description: 'Meter reading updated successfully' })
  @ApiResponse({ status: 404, description: 'Meter reading not found' })
  @ApiResponse({ status: 409, description: 'Duplicate meter reading' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateMeterReadingDto: UpdateMeterReadingDto,
  ) {
    return this.meterReadingsService.update(id, updateMeterReadingDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a meter reading' })
  @ApiResponse({ status: 200, description: 'Meter reading deleted successfully' })
  @ApiResponse({ status: 404, description: 'Meter reading not found' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.meterReadingsService.remove(id);
  }
} 