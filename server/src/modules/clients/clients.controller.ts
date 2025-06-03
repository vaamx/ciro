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
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto';
import { ClientStatus } from '@prisma/client';
import { RequireClientTenantAccess, RequireAuthAndPermissions } from '../../core/auth';
import { PERMISSIONS } from '../../core/auth/jwt.strategy';

@Controller('clients')
@RequireClientTenantAccess()
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  async create(@Body() createClientDto: CreateClientDto, @Request() req) {
    return this.clientsService.create(createClientDto, req.user.id);
  }

  @Get()
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  async findAll(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
    @Query('search') search?: string,
    @Query('status') status?: ClientStatus,
  ) {
    return this.clientsService.findAll(page, limit, search, status);
  }

  @Get(':id')
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.findOne(id);
  }

  @Get(':id/stats')
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
  async getStats(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.getClientStats(id);
  }

  @Patch(':id')
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    return this.clientsService.update(id, updateClientDto);
  }

  @Delete(':id')
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_ADMIN, PERMISSIONS.CLIENT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.clientsService.remove(id);
  }
} 