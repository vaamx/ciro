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
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';
import { CustomerStatus } from '@prisma/client';
import { RequireCustomerTenantAccess, RequireAuthAndPermissions } from '../../core/auth';
import { PERMISSIONS } from '../../core/auth/jwt.strategy';

@Controller('customers')
@RequireCustomerTenantAccess()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @RequireAuthAndPermissions(PERMISSIONS.CUSTOMER_WRITE)
  async create(@Body() createCustomerDto: CreateCustomerDto, @Request() req) {
    return this.customersService.create(createCustomerDto, req.user.id);
  }

  @Get()
  @RequireAuthAndPermissions(PERMISSIONS.CUSTOMER_READ)
  async findAll(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
    @Query('search') search?: string,
    @Query('status') status?: CustomerStatus,
    @Query('clientId', ParseIntPipe) clientId?: number,
  ) {
    return this.customersService.findAll(page, limit, search, status, clientId);
  }

  @Get('by-client/:clientId')
  @RequireAuthAndPermissions(PERMISSIONS.CUSTOMER_READ)
  async findByClient(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.customersService.findByClient(clientId);
  }

  @Get(':id')
  @RequireAuthAndPermissions(PERMISSIONS.CUSTOMER_READ)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.findOne(id);
  }

  @Get(':id/stats')
  @RequireAuthAndPermissions(PERMISSIONS.CUSTOMER_READ)
  async getStats(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.getCustomerStats(id);
  }

  @Patch(':id')
  @RequireAuthAndPermissions(PERMISSIONS.CUSTOMER_WRITE)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @RequireAuthAndPermissions(PERMISSIONS.CUSTOMER_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.customersService.remove(id);
  }
} 