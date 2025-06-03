import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantService } from '../../common/services/tenant.service';
import { CreateClientDto, UpdateClientDto, ClientResponseDto } from './dto';
import { ClientStatus, Prisma } from '@prisma/client';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  async create(createClientDto: CreateClientDto, userId: number): Promise<ClientResponseDto> {
    const organizationId = this.tenantService.getOrganizationId();

    // Check if client code already exists in the organization
    const existingClient = await this.prisma.client.findFirst({
      where: {
        code: createClientDto.code,
        organizationId,
      },
    });

    if (existingClient) {
      throw new ConflictException(`Client with code '${createClientDto.code}' already exists`);
    }

    const client = await this.prisma.client.create({
      data: {
        ...createClientDto,
        organizationId,
        createdById: userId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            customers: true,
          },
        },
      },
    });

    return client;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    status?: ClientStatus,
  ): Promise<{ clients: ClientResponseDto[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    
    const where: Prisma.ClientWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              customers: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      clients,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<ClientResponseDto> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        customers: {
          select: {
            id: true,
            name: true,
            customerNumber: true,
            status: true,
          },
          take: 10, // Limit to first 10 customers
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            customers: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    return client;
  }

  async update(id: number, updateClientDto: UpdateClientDto): Promise<ClientResponseDto> {
    // Check if client exists and user has access
    const existingClient = await this.findOne(id);

    // Check for code conflicts if code is being updated
    if (updateClientDto.code && updateClientDto.code !== existingClient.code) {
      const organizationId = this.tenantService.getOrganizationId();
      const conflictingClient = await this.prisma.client.findFirst({
        where: {
          code: updateClientDto.code,
          organizationId,
          id: { not: id },
        },
      });

      if (conflictingClient) {
        throw new ConflictException(`Client with code '${updateClientDto.code}' already exists`);
      }
    }

    const client = await this.prisma.client.update({
      where: { id },
      data: updateClientDto,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            customers: true,
          },
        },
      },
    });

    return client;
  }

  async remove(id: number): Promise<void> {
    // Check if client exists and user has access
    const existingClient = await this.findOne(id);

    // Check if client has customers
    const customerCount = await this.prisma.customer.count({
      where: { clientId: id },
    });

    if (customerCount > 0) {
      throw new ConflictException(
        `Cannot delete client ${existingClient.name}. It has ${customerCount} customers. Please remove or reassign customers first.`
      );
    }

    await this.prisma.client.delete({
      where: { id },
    });
  }

  async getClientStats(id: number): Promise<{
    totalCustomers: number;
    activeCustomers: number;
    totalInvoices: number;
    pendingInvoices: number;
    totalRevenue: number;
  }> {
    // Check if client exists and user has access
    await this.findOne(id);

    const [customerStats, invoiceStats] = await Promise.all([
      this.prisma.customer.groupBy({
        by: ['status'],
        where: { clientId: id },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: { clientId: id },
        _count: true,
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    const totalCustomers = customerStats.reduce((sum, stat) => sum + stat._count, 0);
    const activeCustomers = customerStats.find(stat => stat.status === 'ACTIVE')?._count || 0;

    const pendingInvoices = await this.prisma.invoice.count({
      where: {
        clientId: id,
        status: { in: ['DRAFT', 'SENT'] },
      },
    });

    return {
      totalCustomers,
      activeCustomers,
      totalInvoices: invoiceStats._count,
      pendingInvoices,
      totalRevenue: Number(invoiceStats._sum.totalAmount || 0),
    };
  }
} 