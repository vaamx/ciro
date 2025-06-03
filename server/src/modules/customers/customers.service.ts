import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantService } from '../../common/services/tenant.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerResponseDto } from './dto';
import { CustomerStatus, Prisma } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  async create(createCustomerDto: CreateCustomerDto, userId: number): Promise<CustomerResponseDto> {
    // Verify that the client belongs to the current organization
    const client = await this.prisma.client.findUnique({
      where: { id: createCustomerDto.clientId },
      select: { id: true, name: true, organizationId: true },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${createCustomerDto.clientId} not found`);
    }

    // Check if customer number already exists within the client
    const existingCustomer = await this.prisma.customer.findFirst({
      where: {
        customerNumber: createCustomerDto.customerNumber,
        clientId: createCustomerDto.clientId,
      },
    });

    if (existingCustomer) {
      throw new ConflictException(
        `Customer with number '${createCustomerDto.customerNumber}' already exists for this client`
      );
    }

    const customer = await this.prisma.customer.create({
      data: {
        ...createCustomerDto,
        createdById: userId,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
            organizationId: true,
          },
        },
        _count: {
          select: {
            meterReadings: true,
            invoices: true,
          },
        },
      },
    });

    return customer;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    status?: CustomerStatus,
    clientId?: number,
  ): Promise<{ customers: CustomerResponseDto[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    
    const where: Prisma.CustomerWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { customerNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { accountNumber: { contains: search, mode: 'insensitive' } },
        { meterNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              code: true,
              organizationId: true,
            },
          },
          _count: {
            select: {
              meterReadings: true,
              invoices: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      customers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<CustomerResponseDto> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
            organizationId: true,
          },
        },
        meterReadings: {
          select: {
            id: true,
            readingDate: true,
            readingValue: true,
            readingType: true,
          },
          take: 5, // Last 5 readings
          orderBy: {
            readingDate: 'desc',
          },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            totalAmount: true,
            status: true,
          },
          take: 5, // Last 5 invoices
          orderBy: {
            invoiceDate: 'desc',
          },
        },
        _count: {
          select: {
            meterReadings: true,
            invoices: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    // Transform the customer data to match the DTO format
    return {
      ...customer,
      meterReadings: customer.meterReadings?.map(reading => ({
        ...reading,
        readingValue: Number(reading.readingValue),
        readingType: reading.readingType.toString(),
      })),
      invoices: customer.invoices?.map(invoice => ({
        ...invoice,
        totalAmount: Number(invoice.totalAmount),
        status: invoice.status.toString(),
      })),
    } as CustomerResponseDto;
  }

  async update(id: number, updateCustomerDto: UpdateCustomerDto): Promise<CustomerResponseDto> {
    // Check if customer exists and user has access
    const existingCustomer = await this.findOne(id);

    // Check for customer number conflicts if being updated
    if (updateCustomerDto.customerNumber && 
        updateCustomerDto.customerNumber !== existingCustomer.customerNumber) {
      const conflictingCustomer = await this.prisma.customer.findFirst({
        where: {
          customerNumber: updateCustomerDto.customerNumber,
          clientId: existingCustomer.clientId,
          id: { not: id },
        },
      });

      if (conflictingCustomer) {
        throw new ConflictException(
          `Customer with number '${updateCustomerDto.customerNumber}' already exists for this client`
        );
      }
    }

    const customer = await this.prisma.customer.update({
      where: { id },
      data: updateCustomerDto,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
            organizationId: true,
          },
        },
        _count: {
          select: {
            meterReadings: true,
            invoices: true,
          },
        },
      },
    });

    return customer;
  }

  async remove(id: number): Promise<void> {
    // Check if customer exists and user has access
    const existingCustomer = await this.findOne(id);

    // Check if customer has meter readings or invoices
    const [meterReadingCount, invoiceCount] = await Promise.all([
      this.prisma.meterReading.count({ where: { customerId: id } }),
      this.prisma.invoice.count({ where: { customerId: id } }),
    ]);

    if (meterReadingCount > 0 || invoiceCount > 0) {
      throw new ConflictException(
        `Cannot delete customer ${existingCustomer.name}. It has ${meterReadingCount} meter readings and ${invoiceCount} invoices. Please clean up associated data first.`
      );
    }

    await this.prisma.customer.delete({
      where: { id },
    });
  }

  async getCustomerStats(id: number): Promise<{
    totalMeterReadings: number;
    latestReading?: {
      date: Date;
      value: number;
    };
    totalInvoices: number;
    pendingInvoices: number;
    totalBilled: number;
    totalPaid: number;
    averageMonthlyUsage: number;
  }> {
    // Check if customer exists and user has access
    await this.findOne(id);

    const [meterStats, invoiceStats, latestReading] = await Promise.all([
      this.prisma.meterReading.aggregate({
        where: { customerId: id },
        _count: true,
        _avg: {
          readingValue: true,
        },
      }),
      this.prisma.invoice.aggregate({
        where: { customerId: id },
        _count: true,
        _sum: {
          totalAmount: true,
          paidAmount: true,
        },
      }),
      this.prisma.meterReading.findFirst({
        where: { customerId: id },
        select: {
          readingDate: true,
          readingValue: true,
        },
        orderBy: {
          readingDate: 'desc',
        },
      }),
    ]);

    const pendingInvoices = await this.prisma.invoice.count({
      where: {
        customerId: id,
        status: { in: ['DRAFT', 'SENT'] },
      },
    });

    return {
      totalMeterReadings: meterStats._count,
      latestReading: latestReading ? {
        date: latestReading.readingDate,
        value: Number(latestReading.readingValue),
      } : undefined,
      totalInvoices: invoiceStats._count,
      pendingInvoices,
      totalBilled: Number(invoiceStats._sum.totalAmount || 0),
      totalPaid: Number(invoiceStats._sum.paidAmount || 0),
      averageMonthlyUsage: Number(meterStats._avg.readingValue || 0),
    };
  }

  async findByClient(clientId: number): Promise<CustomerResponseDto[]> {
    // Verify client access through RLS
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    return this.prisma.customer.findMany({
      where: { clientId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
            organizationId: true,
          },
        },
        _count: {
          select: {
            meterReadings: true,
            invoices: true,
          },
        },
      },
      orderBy: {
        customerNumber: 'asc',
      },
    });
  }
} 