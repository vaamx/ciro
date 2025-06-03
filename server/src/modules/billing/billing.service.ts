import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantService } from '../../common/services/tenant.service';
import { CreateBillingPeriodDto } from './dto/create-billing-period.dto';
import { UpdateBillingPeriodDto } from './dto/update-billing-period.dto';
import { BillingCalculationRequestDto, BillingCalculationResultDto, ChargeBreakdownDto } from './dto/billing-calculation.dto';
import { BillingPeriod, BillingStatus, RateType } from '@prisma/client';

// Type for billing period with all required relations
type BillingPeriodWithRelations = BillingPeriod & {
  customer: {
    id: number;
    name: string;
    client: {
      id: number;
      name: string;
    };
  };
  tariffRate?: {
    id: number;
    name: string;
    code: string;
    rateType: RateType;
    energyRate: any;
    demandRate?: any;
    monthlyCharge?: any;
    tierBlocks?: Array<{
      id: number;
      blockNumber: number;
      fromKwh: any;
      toKwh?: any;
      rate: any;
    }>;
  };
  invoice?: any;
  meterReadings?: any[];
};

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  async create(createBillingPeriodDto: CreateBillingPeriodDto): Promise<BillingPeriod> {
    const organizationId = this.tenantService.getOrganizationId();

    // Verify customer exists and belongs to current organization
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: createBillingPeriodDto.customerId,
        client: {
          organizationId,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found or access denied');
    }

    // Validate dates
    const startDate = new Date(createBillingPeriodDto.startDate);
    const endDate = new Date(createBillingPeriodDto.endDate);
    const dueDate = new Date(createBillingPeriodDto.dueDate);

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    if (dueDate <= endDate) {
      throw new BadRequestException('Due date must be after end date');
    }

    // Check for overlapping billing periods
    const overlappingPeriod = await this.prisma.billingPeriod.findFirst({
      where: {
        customerId: createBillingPeriodDto.customerId,
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (overlappingPeriod) {
      throw new ConflictException('Billing period overlaps with existing period');
    }

    // Verify tariff if provided
    if (createBillingPeriodDto.tariffRateId) {
      const tariff = await this.prisma.tariffRate.findFirst({
        where: {
          id: createBillingPeriodDto.tariffRateId,
          client: {
            organizationId,
          },
        },
      });

      if (!tariff) {
        throw new NotFoundException('Tariff rate not found or access denied');
      }

      // Check if tariff is effective for the billing period
      if (tariff.effectiveFrom > endDate || (tariff.effectiveTo && tariff.effectiveTo < startDate)) {
        throw new BadRequestException('Tariff is not effective for the billing period dates');
      }
    }

    return this.prisma.billingPeriod.create({
      data: {
        startDate,
        endDate,
        dueDate,
        customer: {
          connect: { id: createBillingPeriodDto.customerId },
        },
        ...(createBillingPeriodDto.tariffRateId && {
          tariffRate: {
            connect: { id: createBillingPeriodDto.tariffRateId },
          },
        }),
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
        tariffRate: true,
      },
    });
  }

  async findAll(customerId?: number, status?: BillingStatus, startDate?: string, endDate?: string) {
    const organizationId = this.tenantService.getOrganizationId();

    const where: any = {
      customer: {
        client: {
          organizationId,
        },
      },
    };

    if (customerId) {
      where.customerId = customerId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) {
        where.startDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.startDate.lte = new Date(endDate);
      }
    }

    return this.prisma.billingPeriod.findMany({
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
        tariffRate: {
          select: {
            id: true,
            name: true,
            code: true,
            rateType: true,
            energyRate: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            totalAmount: true,
          },
        },
        _count: {
          select: {
            meterReadings: true,
          },
        },
      },
      orderBy: [
        { startDate: 'desc' },
        { customer: { name: 'asc' } },
      ],
    });
  }

  async findOne(id: number): Promise<BillingPeriodWithRelations> {
    const organizationId = this.tenantService.getOrganizationId();

    const billingPeriod = await this.prisma.billingPeriod.findFirst({
      where: {
        id,
        customer: {
          client: {
            organizationId,
          },
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
        tariffRate: {
          include: {
            tierBlocks: {
              orderBy: {
                blockNumber: 'asc',
              },
            },
          },
        },
        invoice: true,
        meterReadings: {
          orderBy: {
            readingDate: 'asc',
          },
        },
      },
    });

    if (!billingPeriod) {
      throw new NotFoundException('Billing period not found or access denied');
    }

    return billingPeriod as BillingPeriodWithRelations;
  }

  async update(id: number, updateBillingPeriodDto: UpdateBillingPeriodDto): Promise<BillingPeriod> {
    const organizationId = this.tenantService.getOrganizationId();

    // Verify the billing period exists and belongs to current organization
    const existingPeriod = await this.prisma.billingPeriod.findFirst({
      where: {
        id,
        customer: {
          client: {
            organizationId,
          },
        },
      },
    });

    if (!existingPeriod) {
      throw new NotFoundException('Billing period not found or access denied');
    }

    // Prevent updates if already invoiced
    if (existingPeriod.status === BillingStatus.INVOICED || existingPeriod.status === BillingStatus.PAID) {
      throw new ConflictException('Cannot update billing period that has been invoiced or paid');
    }

    // Validate dates if provided
    if (updateBillingPeriodDto.startDate || updateBillingPeriodDto.endDate) {
      const startDate = updateBillingPeriodDto.startDate 
        ? new Date(updateBillingPeriodDto.startDate)
        : existingPeriod.startDate;
      const endDate = updateBillingPeriodDto.endDate 
        ? new Date(updateBillingPeriodDto.endDate)
        : existingPeriod.endDate;

      if (endDate <= startDate) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    return this.prisma.billingPeriod.update({
      where: { id },
      data: {
        ...(updateBillingPeriodDto.startDate && {
          startDate: new Date(updateBillingPeriodDto.startDate),
        }),
        ...(updateBillingPeriodDto.endDate && {
          endDate: new Date(updateBillingPeriodDto.endDate),
        }),
        ...(updateBillingPeriodDto.dueDate && {
          dueDate: new Date(updateBillingPeriodDto.dueDate),
        }),
        ...(updateBillingPeriodDto.tariffRateId && {
          tariffRateId: updateBillingPeriodDto.tariffRateId,
        }),
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
        tariffRate: true,
      },
    });
  }

  async remove(id: number): Promise<void> {
    const organizationId = this.tenantService.getOrganizationId();

    // Verify the billing period exists and belongs to current organization
    const existingPeriod = await this.prisma.billingPeriod.findFirst({
      where: {
        id,
        customer: {
          client: {
            organizationId,
          },
        },
      },
      include: {
        invoice: true,
      },
    });

    if (!existingPeriod) {
      throw new NotFoundException('Billing period not found or access denied');
    }

    // Prevent deletion if has invoice or is paid
    if (existingPeriod.invoice) {
      throw new ConflictException('Cannot delete billing period that has an associated invoice');
    }

    if (existingPeriod.status === BillingStatus.PAID) {
      throw new ConflictException('Cannot delete paid billing period');
    }

    await this.prisma.billingPeriod.delete({
      where: { id },
    });
  }

  async calculateBilling(requestDto: BillingCalculationRequestDto): Promise<BillingCalculationResultDto> {
    const billingPeriod = await this.findOne(requestDto.billingPeriodId);
    
    if (!billingPeriod.tariffRate) {
      throw new BadRequestException('Billing period must have an associated tariff rate for calculation');
    }

    // Get meter readings for the billing period
    const meterReadings = await this.prisma.meterReading.findMany({
      where: {
        customerId: billingPeriod.customerId,
        readingDate: {
          gte: billingPeriod.startDate,
          lte: billingPeriod.endDate,
        },
      },
      orderBy: {
        readingDate: 'asc',
      },
    });

    if (meterReadings.length === 0) {
      throw new BadRequestException('No meter readings found for billing period');
    }

    // Calculate total consumption
    const totalKwh = requestDto.overrideTotalKwh || this.calculateTotalConsumption(meterReadings);
    const peakDemand = this.calculatePeakDemand(meterReadings);
    const billingDays = Math.ceil((billingPeriod.endDate.getTime() - billingPeriod.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const averageDailyUsage = totalKwh / billingDays;

    // Calculate charges based on tariff type
    const chargeBreakdown: ChargeBreakdownDto[] = [];
    let energyCharges = 0;
    let demandCharges = 0;

    switch (billingPeriod.tariffRate.rateType) {
      case RateType.FLAT:
        energyCharges = totalKwh * Number(billingPeriod.tariffRate.energyRate);
        chargeBreakdown.push({
          description: 'Energy Charges (Flat Rate)',
          kwh: totalKwh,
          rate: Number(billingPeriod.tariffRate.energyRate),
          amount: energyCharges,
        });
        break;

      case RateType.TIERED:
        const tierCalculation = this.calculateTieredCharges(totalKwh, billingPeriod.tariffRate.tierBlocks || []);
        energyCharges = tierCalculation.totalCharges;
        chargeBreakdown.push(...tierCalculation.breakdown);
        break;

      case RateType.TIME_OF_USE:
        // For time-of-use, we would need to classify readings by time period
        // For now, using a simplified approach
        energyCharges = totalKwh * Number(billingPeriod.tariffRate.energyRate);
        chargeBreakdown.push({
          description: 'Energy Charges (Time-of-Use)',
          kwh: totalKwh,
          rate: Number(billingPeriod.tariffRate.energyRate),
          amount: energyCharges,
        });
        break;

      default:
        energyCharges = totalKwh * Number(billingPeriod.tariffRate.energyRate);
    }

    // Calculate demand charges if applicable
    if (billingPeriod.tariffRate.demandRate && peakDemand) {
      demandCharges = peakDemand * Number(billingPeriod.tariffRate.demandRate);
      chargeBreakdown.push({
        description: 'Demand Charges',
        kwh: peakDemand,
        rate: Number(billingPeriod.tariffRate.demandRate),
        amount: demandCharges,
      });
    }

    // Add monthly charges if applicable
    if (billingPeriod.tariffRate.monthlyCharge) {
      const monthlyCharge = Number(billingPeriod.tariffRate.monthlyCharge);
      chargeBreakdown.push({
        description: 'Monthly Service Charge',
        amount: monthlyCharge,
      });
      energyCharges += monthlyCharge;
    }

    // Calculate taxes (simplified - could be more complex based on requirements)
    const taxes = (energyCharges + demandCharges) * 0.08; // Assuming 8% tax
    const adjustments = 0; // No adjustments for now
    const totalAmount = energyCharges + demandCharges + taxes + adjustments;

    // Update billing period with calculated totals
    await this.prisma.billingPeriod.update({
      where: { id: billingPeriod.id },
      data: {
        totalKwh: Number(totalKwh),
        totalAmount: Number(totalAmount),
        status: BillingStatus.CALCULATED,
      },
    });

    return {
      billingPeriodId: billingPeriod.id,
      totalKwh,
      peakDemand,
      billingDays,
      averageDailyUsage,
      energyCharges,
      demandCharges,
      taxes,
      adjustments,
      totalAmount,
      chargeBreakdown,
      tariffUsed: {
        id: billingPeriod.tariffRate.id,
        name: billingPeriod.tariffRate.name,
        code: billingPeriod.tariffRate.code,
        rateType: billingPeriod.tariffRate.rateType,
      },
      calculatedAt: new Date().toISOString(),
      meterReadingsCount: meterReadings.length,
    };
  }

  async getBillingStats(customerId?: number) {
    const organizationId = this.tenantService.getOrganizationId();

    const where: any = {
      customer: {
        client: {
          organizationId,
        },
      },
    };

    if (customerId) {
      where.customerId = customerId;
    }

    const [totalPeriods, periodsByStatus] = await Promise.all([
      this.prisma.billingPeriod.count({ where }),
      this.prisma.billingPeriod.groupBy({
        by: ['status'],
        where,
        _count: {
          id: true,
        },
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    return {
      totalPeriods,
      periodsByStatus: periodsByStatus.reduce((acc, item) => {
        acc[item.status] = {
          count: item._count.id,
          totalAmount: Number(item._sum.totalAmount) || 0,
        };
        return acc;
      }, {} as Record<string, { count: number; totalAmount: number }>),
    };
  }

  private calculateTotalConsumption(readings: any[]): number {
    // Calculate total consumption from readings
    // This is a simplified version - in reality, you might need more complex logic
    // to handle different reading types and calculate consumption between readings
    return readings.reduce((total, reading) => total + Number(reading.readingValue), 0);
  }

  private calculatePeakDemand(readings: any[]): number | undefined {
    // Find peak demand from readings
    const demandReadings = readings.filter(r => r.demandReading);
    if (demandReadings.length === 0) return undefined;
    
    return Math.max(...demandReadings.map(r => Number(r.demandReading)));
  }

  private calculateTieredCharges(totalKwh: number, tierBlocks: any[]): { totalCharges: number; breakdown: ChargeBreakdownDto[] } {
    let remainingKwh = totalKwh;
    let totalCharges = 0;
    const breakdown: ChargeBreakdownDto[] = [];

    for (const block of tierBlocks.sort((a, b) => a.blockNumber - b.blockNumber)) {
      if (remainingKwh <= 0) break;

      const blockKwh = Math.min(
        remainingKwh,
        block.toKwh ? Number(block.toKwh) - Number(block.fromKwh) : remainingKwh
      );
      
      const blockCharges = blockKwh * Number(block.rate);
      totalCharges += blockCharges;
      
      breakdown.push({
        description: `Tier ${block.blockNumber} (${block.fromKwh} - ${block.toKwh || '∞'} kWh)`,
        kwh: blockKwh,
        rate: Number(block.rate),
        amount: blockCharges,
      });

      remainingKwh -= blockKwh;
    }

    return { totalCharges, breakdown };
  }
} 