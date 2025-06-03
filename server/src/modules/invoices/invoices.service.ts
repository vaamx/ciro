import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantService } from '../../common/services/tenant.service';
import { BillingService } from '../billing/billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { GenerateInvoiceDto, ProcessPaymentDto, BulkInvoiceGenerationDto, InvoiceGenerationResultDto } from './dto/invoice-generation.dto';
import { Invoice, InvoiceStatus, BillingStatus } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly billingService: BillingService,
  ) {}

  async create(createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
    const organizationId = this.tenantService.getOrganizationId();

    // Verify billing period exists and belongs to current organization
    const billingPeriod = await this.prisma.billingPeriod.findFirst({
      where: {
        id: createInvoiceDto.billingPeriodId,
        customer: {
          client: {
            organizationId,
          },
        },
      },
      include: {
        customer: {
          include: {
            client: true,
          },
        },
        invoice: true,
      },
    });

    if (!billingPeriod) {
      throw new NotFoundException('Billing period not found or access denied');
    }

    if (billingPeriod.invoice) {
      throw new ConflictException('Invoice already exists for this billing period');
    }

    // Ensure billing period is calculated
    if (billingPeriod.status === BillingStatus.DRAFT) {
      throw new BadRequestException('Billing period must be calculated before creating invoice');
    }

    // Validate dates
    const invoiceDate = new Date(createInvoiceDto.invoiceDate);
    const dueDate = new Date(createInvoiceDto.dueDate);

    if (dueDate <= invoiceDate) {
      throw new BadRequestException('Due date must be after invoice date');
    }

    // Check for duplicate invoice number
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        clientId: billingPeriod.customer.clientId,
        invoiceNumber: createInvoiceDto.invoiceNumber,
      },
    });

    if (existingInvoice) {
      throw new ConflictException('Invoice number already exists for this client');
    }

    // Use calculated values from billing period or provided values
    const energyCharges = createInvoiceDto.energyCharges ?? 0;
    const demandCharges = createInvoiceDto.demandCharges ?? 0;
    const taxes = createInvoiceDto.taxes ?? 0;
    const adjustments = createInvoiceDto.adjustments ?? 0;
    const totalAmount = createInvoiceDto.totalAmount ?? 
      (Number(billingPeriod.totalAmount) || (energyCharges + demandCharges + taxes + adjustments));

    return this.prisma.invoice.create({
      data: {
        invoiceNumber: createInvoiceDto.invoiceNumber,
        invoiceDate,
        dueDate,
        energyCharges: Number(energyCharges),
        demandCharges: Number(demandCharges),
        taxes: Number(taxes),
        adjustments: Number(adjustments),
        totalAmount: Number(totalAmount),
        totalKwh: Number(billingPeriod.totalKwh) || 0,
        billingDays: Math.ceil((billingPeriod.endDate.getTime() - billingPeriod.startDate.getTime()) / (1000 * 60 * 60 * 24)),
        customer: {
          connect: { id: billingPeriod.customerId },
        },
        client: {
          connect: { id: billingPeriod.customer.clientId },
        },
        billingPeriod: {
          connect: { id: createInvoiceDto.billingPeriodId },
        },
      },
      include: {
        customer: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        billingPeriod: true,
      },
    });
  }

  async generateFromBillingPeriod(generateDto: GenerateInvoiceDto): Promise<Invoice> {
    const organizationId = this.tenantService.getOrganizationId();

    // Get billing period with calculation if needed
    const billingPeriod = await this.billingService.findOne(generateDto.billingPeriodId);

    // Ensure billing period is calculated
    if (billingPeriod.status === BillingStatus.DRAFT) {
      // Automatically calculate if not done yet
      await this.billingService.calculateBilling({ billingPeriodId: generateDto.billingPeriodId });
      // Refresh the billing period
      const updatedBillingPeriod = await this.billingService.findOne(generateDto.billingPeriodId);
      Object.assign(billingPeriod, updatedBillingPeriod);
    }

    // Generate invoice number if not provided
    const invoiceNumber = generateDto.invoiceNumber || await this.generateInvoiceNumber(billingPeriod.customer.client.id);

    // Set dates
    const invoiceDate = generateDto.invoiceDate ? new Date(generateDto.invoiceDate) : new Date();
    const dueDate = generateDto.dueDate ? new Date(generateDto.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    // Create invoice with calculated billing data
    const createDto: CreateInvoiceDto = {
      billingPeriodId: generateDto.billingPeriodId,
      invoiceNumber,
      invoiceDate: invoiceDate.toISOString(),
      dueDate: dueDate.toISOString(),
      totalAmount: Number(billingPeriod.totalAmount),
    };

    const invoice = await this.create(createDto);

    // Update billing period status
    await this.prisma.billingPeriod.update({
      where: { id: generateDto.billingPeriodId },
      data: { status: BillingStatus.INVOICED },
    });

    return invoice;
  }

  async bulkGenerate(bulkDto: BulkInvoiceGenerationDto): Promise<InvoiceGenerationResultDto[]> {
    const results: InvoiceGenerationResultDto[] = [];

    for (const billingPeriodId of bulkDto.billingPeriodIds) {
      try {
        const generateDto: GenerateInvoiceDto = {
          billingPeriodId,
          invoiceDate: bulkDto.invoiceDate,
          dueDate: bulkDto.dueDate,
        };

        const invoice = await this.generateFromBillingPeriod(generateDto);

        results.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          billingPeriodId: invoice.billingPeriodId,
          customerId: invoice.customerId,
          customerName: (invoice as any).customer?.name || 'Unknown',
          totalAmount: Number(invoice.totalAmount),
          status: invoice.status,
          generatedAt: new Date().toISOString(),
        });
      } catch (error) {
        // Get customer info for error reporting
        const billingPeriod = await this.prisma.billingPeriod.findFirst({
          where: { id: billingPeriodId },
          include: { customer: true },
        });

        results.push({
          invoiceId: 0,
          invoiceNumber: '',
          billingPeriodId,
          customerId: billingPeriod?.customerId || 0,
          customerName: billingPeriod?.customer?.name || 'Unknown',
          totalAmount: 0,
          status: InvoiceStatus.DRAFT,
          generatedAt: new Date().toISOString(),
          errors: [error.message],
        });
      }
    }

    return results;
  }

  async findAll(customerId?: number, status?: InvoiceStatus, startDate?: string, endDate?: string) {
    const organizationId = this.tenantService.getOrganizationId();

    const where: any = {
      client: {
        organizationId,
      },
    };

    if (customerId) {
      where.customerId = customerId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) {
        where.invoiceDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.invoiceDate.lte = new Date(endDate);
      }
    }

    return this.prisma.invoice.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            accountNumber: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        billingPeriod: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
      },
      orderBy: [
        { invoiceDate: 'desc' },
        { customer: { name: 'asc' } },
      ],
    });
  }

  async findOne(id: number): Promise<Invoice> {
    const organizationId = this.tenantService.getOrganizationId();

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        client: {
          organizationId,
        },
      },
      include: {
        customer: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        billingPeriod: {
          include: {
            tariffRate: {
              select: {
                id: true,
                name: true,
                code: true,
                rateType: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found or access denied');
    }

    return invoice;
  }

  async update(id: number, updateInvoiceDto: UpdateInvoiceDto): Promise<Invoice> {
    const organizationId = this.tenantService.getOrganizationId();

    // Verify the invoice exists and belongs to current organization
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        client: {
          organizationId,
        },
      },
    });

    if (!existingInvoice) {
      throw new NotFoundException('Invoice not found or access denied');
    }

    // Prevent updates to paid invoices
    if (existingInvoice.status === InvoiceStatus.PAID) {
      throw new ConflictException('Cannot update paid invoice');
    }

    // Validate dates if provided
    if (updateInvoiceDto.invoiceDate || updateInvoiceDto.dueDate) {
      const invoiceDate = updateInvoiceDto.invoiceDate 
        ? new Date(updateInvoiceDto.invoiceDate)
        : existingInvoice.invoiceDate;
      const dueDate = updateInvoiceDto.dueDate 
        ? new Date(updateInvoiceDto.dueDate)
        : existingInvoice.dueDate;

      if (dueDate <= invoiceDate) {
        throw new BadRequestException('Due date must be after invoice date');
      }
    }

    // Check for duplicate invoice number if changed
    if (updateInvoiceDto.invoiceNumber && updateInvoiceDto.invoiceNumber !== existingInvoice.invoiceNumber) {
      const duplicateInvoice = await this.prisma.invoice.findFirst({
        where: {
          clientId: existingInvoice.clientId,
          invoiceNumber: updateInvoiceDto.invoiceNumber,
          id: { not: id },
        },
      });

      if (duplicateInvoice) {
        throw new ConflictException('Invoice number already exists for this client');
      }
    }

    // Recalculate total if financial fields are updated
    let updatedTotalAmount = updateInvoiceDto.totalAmount;
    if (updateInvoiceDto.energyCharges !== undefined || 
        updateInvoiceDto.demandCharges !== undefined || 
        updateInvoiceDto.taxes !== undefined || 
        updateInvoiceDto.adjustments !== undefined) {
      
      const energyCharges = updateInvoiceDto.energyCharges ?? Number(existingInvoice.energyCharges);
      const demandCharges = updateInvoiceDto.demandCharges ?? Number(existingInvoice.demandCharges);
      const taxes = updateInvoiceDto.taxes ?? Number(existingInvoice.taxes);
      const adjustments = updateInvoiceDto.adjustments ?? Number(existingInvoice.adjustments);
      
      updatedTotalAmount = energyCharges + demandCharges + taxes + adjustments;
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        ...(updateInvoiceDto.invoiceNumber && { invoiceNumber: updateInvoiceDto.invoiceNumber }),
        ...(updateInvoiceDto.invoiceDate && { invoiceDate: new Date(updateInvoiceDto.invoiceDate) }),
        ...(updateInvoiceDto.dueDate && { dueDate: new Date(updateInvoiceDto.dueDate) }),
        ...(updateInvoiceDto.energyCharges !== undefined && { energyCharges: Number(updateInvoiceDto.energyCharges) }),
        ...(updateInvoiceDto.demandCharges !== undefined && { demandCharges: Number(updateInvoiceDto.demandCharges) }),
        ...(updateInvoiceDto.taxes !== undefined && { taxes: Number(updateInvoiceDto.taxes) }),
        ...(updateInvoiceDto.adjustments !== undefined && { adjustments: Number(updateInvoiceDto.adjustments) }),
        ...(updatedTotalAmount !== undefined && { totalAmount: Number(updatedTotalAmount) }),
      },
      include: {
        customer: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        billingPeriod: true,
      },
    });
  }

  async processPayment(id: number, paymentDto: ProcessPaymentDto): Promise<Invoice> {
    const organizationId = this.tenantService.getOrganizationId();

    // Verify the invoice exists and belongs to current organization
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        client: {
          organizationId,
        },
      },
      include: {
        billingPeriod: true,
      },
    });

    if (!existingInvoice) {
      throw new NotFoundException('Invoice not found or access denied');
    }

    if (existingInvoice.status === InvoiceStatus.PAID) {
      throw new ConflictException('Invoice is already paid');
    }

    if (existingInvoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException('Cannot process payment for cancelled invoice');
    }

    // Validate payment amount
    if (paymentDto.paidAmount > Number(existingInvoice.totalAmount)) {
      throw new BadRequestException('Payment amount cannot exceed invoice total');
    }

    const isPaidInFull = paymentDto.paidAmount >= Number(existingInvoice.totalAmount);

    // Process payment
    const updatedInvoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        paidAmount: Number(paymentDto.paidAmount),
        paidDate: new Date(paymentDto.paidDate),
        status: isPaidInFull ? InvoiceStatus.PAID : InvoiceStatus.SENT,
        metadata: {
          ...existingInvoice.metadata as any,
          paymentReference: paymentDto.paymentReference,
          paymentMethod: paymentDto.paymentMethod,
        },
      },
      include: {
        customer: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        billingPeriod: true,
      },
    });

    // Update billing period status if paid in full
    if (isPaidInFull) {
      await this.prisma.billingPeriod.update({
        where: { id: existingInvoice.billingPeriodId },
        data: { status: BillingStatus.PAID },
      });
    }

    return updatedInvoice;
  }

  async remove(id: number): Promise<void> {
    const organizationId = this.tenantService.getOrganizationId();

    // Verify the invoice exists and belongs to current organization
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        client: {
          organizationId,
        },
      },
      include: {
        billingPeriod: true,
      },
    });

    if (!existingInvoice) {
      throw new NotFoundException('Invoice not found or access denied');
    }

    // Prevent deletion of paid invoices
    if (existingInvoice.status === InvoiceStatus.PAID) {
      throw new ConflictException('Cannot delete paid invoice');
    }

    // Reset billing period status when deleting invoice
    await this.prisma.billingPeriod.update({
      where: { id: existingInvoice.billingPeriodId },
      data: { status: BillingStatus.CALCULATED },
    });

    await this.prisma.invoice.delete({
      where: { id },
    });
  }

  async getInvoiceStats(customerId?: number) {
    const organizationId = this.tenantService.getOrganizationId();

    const where: any = {
      client: {
        organizationId,
      },
    };

    if (customerId) {
      where.customerId = customerId;
    }

    const [totalInvoices, invoicesByStatus, totalRevenue, overdueTotals] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where,
        _count: {
          id: true,
        },
        _sum: {
          totalAmount: true,
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          ...where,
          status: InvoiceStatus.PAID,
        },
        _sum: {
          totalAmount: true,
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          ...where,
          status: InvoiceStatus.OVERDUE,
        },
        _sum: {
          totalAmount: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    return {
      totalInvoices,
      totalRevenue: Number(totalRevenue._sum.totalAmount) || 0,
      overdueCount: overdueTotals._count.id || 0,
      overdueAmount: Number(overdueTotals._sum.totalAmount) || 0,
      invoicesByStatus: invoicesByStatus.reduce((acc, item) => {
        acc[item.status] = {
          count: item._count.id,
          totalAmount: Number(item._sum.totalAmount) || 0,
        };
        return acc;
      }, {} as Record<string, { count: number; totalAmount: number }>),
    };
  }

  private async generateInvoiceNumber(clientId: number): Promise<string> {
    const currentYear = new Date().getFullYear();
    
    // Get the latest invoice number for this client and year
    const latestInvoice = await this.prisma.invoice.findFirst({
      where: {
        clientId,
        invoiceNumber: {
          startsWith: `INV-${currentYear}-`,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    let nextNumber = 1;
    if (latestInvoice) {
      const lastNumber = parseInt(latestInvoice.invoiceNumber.split('-')[2]);
      nextNumber = lastNumber + 1;
    }

    return `INV-${currentYear}-${nextNumber.toString().padStart(6, '0')}`;
  }
} 