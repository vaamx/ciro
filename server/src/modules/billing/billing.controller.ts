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
import { BillingService } from './billing.service';
import { CreateBillingPeriodDto } from './dto/create-billing-period.dto';
import { UpdateBillingPeriodDto } from './dto/update-billing-period.dto';
import { BillingCalculationRequestDto } from './dto/billing-calculation.dto';
import { RequireClientTenantAccess, RequireAuthAndPermissions } from '../../core/auth';
import { PERMISSIONS } from '../../core/auth/jwt.strategy';
import { BillingStatus } from '@prisma/client';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
@RequireClientTenantAccess()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('periods')
  @ApiOperation({ summary: 'Create a new billing period' })
  @ApiResponse({ status: 201, description: 'Billing period created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Overlapping billing period' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  createBillingPeriod(@Body(ValidationPipe) createBillingPeriodDto: CreateBillingPeriodDto) {
    return this.billingService.create(createBillingPeriodDto);
  }

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate billing charges for a billing period' })
  @ApiResponse({ status: 200, description: 'Billing calculation completed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid billing period or missing data' })
  @ApiResponse({ status: 404, description: 'Billing period not found' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  calculateBilling(@Body(ValidationPipe) calculationDto: BillingCalculationRequestDto) {
    return this.billingService.calculateBilling(calculationDto);
  }

  @Get('periods')
  @ApiOperation({ summary: 'Get all billing periods with optional filters' })
  @ApiResponse({ status: 200, description: 'Billing periods retrieved successfully' })
  @ApiQuery({ name: 'customerId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: BillingStatus })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  findAllBillingPeriods(
    @Query('customerId', new ParseIntPipe({ optional: true })) customerId?: number,
    @Query('status') status?: BillingStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.billingService.findAll(customerId, status, startDate, endDate);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get billing statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiQuery({ name: 'customerId', required: false, type: Number })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  getBillingStats(@Query('customerId', new ParseIntPipe({ optional: true })) customerId?: number) {
    return this.billingService.getBillingStats(customerId);
  }

  @Get('periods/:id')
  @ApiOperation({ summary: 'Get a specific billing period by ID' })
  @ApiResponse({ status: 200, description: 'Billing period retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Billing period not found' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  findOneBillingPeriod(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.findOne(id);
  }

  @Patch('periods/:id')
  @ApiOperation({ summary: 'Update a billing period' })
  @ApiResponse({ status: 200, description: 'Billing period updated successfully' })
  @ApiResponse({ status: 404, description: 'Billing period not found' })
  @ApiResponse({ status: 409, description: 'Cannot update invoiced/paid billing period' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  updateBillingPeriod(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateBillingPeriodDto: UpdateBillingPeriodDto,
  ) {
    return this.billingService.update(id, updateBillingPeriodDto);
  }

  @Delete('periods/:id')
  @ApiOperation({ summary: 'Delete a billing period' })
  @ApiResponse({ status: 200, description: 'Billing period deleted successfully' })
  @ApiResponse({ status: 404, description: 'Billing period not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete billing period with invoice' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  removeBillingPeriod(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.remove(id);
  }
} 