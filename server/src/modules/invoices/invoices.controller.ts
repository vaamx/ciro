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
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { GenerateInvoiceDto, ProcessPaymentDto, BulkInvoiceGenerationDto } from './dto/invoice-generation.dto';
import { RequireClientTenantAccess, RequireAuthAndPermissions } from '../../core/auth';
import { PERMISSIONS } from '../../core/auth/jwt.strategy';
import { InvoiceStatus } from '@prisma/client';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
@RequireClientTenantAccess()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new invoice manually' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Invoice already exists for billing period' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  create(@Body(ValidationPipe) createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(createInvoiceDto);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate invoice from billing period' })
  @ApiResponse({ status: 201, description: 'Invoice generated successfully' })
  @ApiResponse({ status: 400, description: 'Billing period not calculated or invalid' })
  @ApiResponse({ status: 409, description: 'Invoice already exists for billing period' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  generateFromBillingPeriod(@Body(ValidationPipe) generateDto: GenerateInvoiceDto) {
    return this.invoicesService.generateFromBillingPeriod(generateDto);
  }

  @Post('bulk-generate')
  @ApiOperation({ summary: 'Generate multiple invoices from billing periods' })
  @ApiResponse({ status: 201, description: 'Bulk invoice generation completed' })
  @ApiResponse({ status: 400, description: 'Invalid billing periods' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  bulkGenerate(@Body(ValidationPipe) bulkDto: BulkInvoiceGenerationDto) {
    return this.invoicesService.bulkGenerate(bulkDto);
  }

  @Post(':id/payment')
  @ApiOperation({ summary: 'Process payment for an invoice' })
  @ApiResponse({ status: 200, description: 'Payment processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payment data' })
  @ApiResponse({ status: 409, description: 'Invoice already paid or cancelled' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  processPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) paymentDto: ProcessPaymentDto,
  ) {
    return this.invoicesService.processPayment(id, paymentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all invoices with optional filters' })
  @ApiResponse({ status: 200, description: 'Invoices retrieved successfully' })
  @ApiQuery({ name: 'customerId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  findAll(
    @Query('customerId', new ParseIntPipe({ optional: true })) customerId?: number,
    @Query('status') status?: InvoiceStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.invoicesService.findAll(customerId, status, startDate, endDate);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get invoice statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiQuery({ name: 'customerId', required: false, type: Number })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  getInvoiceStats(@Query('customerId', new ParseIntPipe({ optional: true })) customerId?: number) {
    return this.invoicesService.getInvoiceStats(customerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific invoice by ID' })
  @ApiResponse({ status: 200, description: 'Invoice retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an invoice' })
  @ApiResponse({ status: 200, description: 'Invoice updated successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 409, description: 'Cannot update paid invoice' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateInvoiceDto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(id, updateInvoiceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an invoice' })
  @ApiResponse({ status: 200, description: 'Invoice deleted successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete paid invoice' })
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.remove(id);
  }
} 