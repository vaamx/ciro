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
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { TariffsService } from './tariffs.service';
import { CreateTariffDto } from './dto/create-tariff.dto';
import { UpdateTariffDto } from './dto/update-tariff.dto';
import { RequireClientTenantAccess, RequireAuthAndPermissions } from '../../core/auth';
import { PERMISSIONS } from '../../core/auth/jwt.strategy';
import { TariffStatus, RateType } from '@prisma/client';

@ApiTags('Tariffs')
@ApiBearerAuth()
@Controller('tariffs')
@RequireClientTenantAccess()
export class TariffsController {
  constructor(private readonly tariffsService: TariffsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tariff rate' })
  @ApiResponse({ status: 201, description: 'Tariff rate created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Duplicate tariff code' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  create(
    @Body(ValidationPipe) createTariffDto: CreateTariffDto,
    @Request() req,
    @Query('clientId', new ParseIntPipe({ optional: true })) clientId?: number,
  ) {
    // Use clientId from query or from request context
    const targetClientId = clientId || req.clientId;
    return this.tariffsService.create(createTariffDto, targetClientId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tariff rates with optional filters' })
  @ApiResponse({ status: 200, description: 'Tariff rates retrieved successfully' })
  @ApiQuery({ name: 'clientId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: TariffStatus })
  @ApiQuery({ name: 'rateType', required: false, enum: RateType })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  findAll(
    @Query('clientId', new ParseIntPipe({ optional: true })) clientId?: number,
    @Query('status') status?: TariffStatus,
    @Query('rateType') rateType?: RateType,
  ) {
    return this.tariffsService.findAll(clientId, status, rateType);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get currently active tariff rates' })
  @ApiResponse({ status: 200, description: 'Active tariff rates retrieved successfully' })
  @ApiQuery({ name: 'clientId', required: false, type: Number })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  getActiveTariffs(@Query('clientId', new ParseIntPipe({ optional: true })) clientId?: number) {
    return this.tariffsService.getActiveTariffs(clientId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get tariff rate statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiQuery({ name: 'clientId', required: false, type: Number })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  getStats(@Query('clientId', new ParseIntPipe({ optional: true })) clientId?: number) {
    return this.tariffsService.getTariffStats(clientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific tariff rate by ID' })
  @ApiResponse({ status: 200, description: 'Tariff rate retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tariff rate not found' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tariffsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tariff rate' })
  @ApiResponse({ status: 200, description: 'Tariff rate updated successfully' })
  @ApiResponse({ status: 404, description: 'Tariff rate not found' })
  @ApiResponse({ status: 409, description: 'Duplicate tariff code' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateTariffDto: UpdateTariffDto,
  ) {
    return this.tariffsService.update(id, updateTariffDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a tariff rate' })
  @ApiResponse({ status: 200, description: 'Tariff rate deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tariff rate not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete tariff in use' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tariffsService.remove(id);
  }
} 