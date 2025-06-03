import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantService } from '../../common/services/tenant.service';
import { CreateTariffDto } from './dto/create-tariff.dto';
import { UpdateTariffDto } from './dto/update-tariff.dto';
import { TariffRate, TariffStatus, RateType } from '@prisma/client';

@Injectable()
export class TariffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  async create(createTariffDto: CreateTariffDto, clientId: number): Promise<TariffRate> {
    const organizationId = this.tenantService.getOrganizationId();

    if (!clientId) {
      throw new BadRequestException('Client ID is required');
    }

    // Verify client exists and belongs to current organization
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found or access denied');
    }

    // Check for duplicate code within the client
    const existingTariff = await this.prisma.tariffRate.findFirst({
      where: {
        clientId: clientId,
        code: createTariffDto.code,
      },
    });

    if (existingTariff) {
      throw new ConflictException(`Tariff with code '${createTariffDto.code}' already exists for this client`);
    }

    // Validate effective dates
    const effectiveFrom = new Date(createTariffDto.effectiveFrom);
    const effectiveTo = createTariffDto.effectiveTo ? new Date(createTariffDto.effectiveTo) : null;

    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new BadRequestException('Effective to date must be after effective from date');
    }

    // Validate rate type requirements
    this.validateRateTypeRequirements(createTariffDto);

    return this.prisma.tariffRate.create({
      data: {
        name: createTariffDto.name,
        code: createTariffDto.code,
        description: createTariffDto.description,
        rateType: createTariffDto.rateType,
        energyRate: createTariffDto.energyRate,
        onPeakRate: createTariffDto.onPeakRate,
        offPeakRate: createTariffDto.offPeakRate,
        midPeakRate: createTariffDto.midPeakRate,
        demandRate: createTariffDto.demandRate,
        monthlyCharge: createTariffDto.monthlyCharge,
        connectionFee: createTariffDto.connectionFee,
        effectiveFrom,
        effectiveTo,
        status: createTariffDto.status || TariffStatus.DRAFT,
        metadata: createTariffDto.metadata,
        client: {
          connect: { id: clientId },
        },
        // Create tier blocks if provided
        ...(createTariffDto.tierBlocks && {
          tierBlocks: {
            create: createTariffDto.tierBlocks.map(block => ({
              blockNumber: block.blockNumber,
              fromKwh: block.fromKwh,
              toKwh: block.toKwh,
              rate: block.rate,
            })),
          },
        }),
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        tierBlocks: {
          orderBy: {
            blockNumber: 'asc',
          },
        },
      },
    });
  }

  async findAll(clientId?: number, status?: TariffStatus, rateType?: RateType) {
    const organizationId = this.tenantService.getOrganizationId();

    const where: any = {
      client: {
        organizationId,
      },
    };

    if (clientId) {
      where.clientId = clientId;
    }

    if (status) {
      where.status = status;
    }

    if (rateType) {
      where.rateType = rateType;
    }

    return this.prisma.tariffRate.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        tierBlocks: {
          orderBy: {
            blockNumber: 'asc',
          },
        },
      },
      orderBy: [
        { effectiveFrom: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  async findOne(id: number): Promise<TariffRate> {
    const organizationId = this.tenantService.getOrganizationId();

    const tariffRate = await this.prisma.tariffRate.findFirst({
      where: {
        id,
        client: {
          organizationId,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        tierBlocks: {
          orderBy: {
            blockNumber: 'asc',
          },
        },
      },
    });

    if (!tariffRate) {
      throw new NotFoundException('Tariff rate not found or access denied');
    }

    return tariffRate;
  }

  async update(id: number, updateTariffDto: UpdateTariffDto): Promise<TariffRate> {
    const organizationId = this.tenantService.getOrganizationId();

    // Verify the tariff exists and belongs to current organization
    const existingTariff = await this.prisma.tariffRate.findFirst({
      where: {
        id,
        client: {
          organizationId,
        },
      },
      include: {
        tierBlocks: true,
      },
    });

    if (!existingTariff) {
      throw new NotFoundException('Tariff rate not found or access denied');
    }

    // Check for duplicate code if code is being updated
    if (updateTariffDto.code && updateTariffDto.code !== existingTariff.code) {
      const duplicateTariff = await this.prisma.tariffRate.findFirst({
        where: {
          clientId: existingTariff.clientId,
          code: updateTariffDto.code,
          id: { not: id },
        },
      });

      if (duplicateTariff) {
        throw new ConflictException(`Tariff with code '${updateTariffDto.code}' already exists for this client`);
      }
    }

    // Validate effective dates if provided
    if (updateTariffDto.effectiveFrom || updateTariffDto.effectiveTo) {
      const effectiveFrom = updateTariffDto.effectiveFrom 
        ? new Date(updateTariffDto.effectiveFrom)
        : existingTariff.effectiveFrom;
      const effectiveTo = updateTariffDto.effectiveTo 
        ? new Date(updateTariffDto.effectiveTo)
        : existingTariff.effectiveTo;

      if (effectiveTo && effectiveTo <= effectiveFrom) {
        throw new BadRequestException('Effective to date must be after effective from date');
      }
    }

    // Validate rate type requirements if rateType is being updated
    if (updateTariffDto.rateType) {
      this.validateRateTypeRequirements({ 
        ...existingTariff, 
        ...updateTariffDto 
      } as CreateTariffDto);
    }

    return this.prisma.tariffRate.update({
      where: { id },
      data: {
        ...(updateTariffDto.name && { name: updateTariffDto.name }),
        ...(updateTariffDto.code && { code: updateTariffDto.code }),
        ...(updateTariffDto.description !== undefined && { description: updateTariffDto.description }),
        ...(updateTariffDto.rateType && { rateType: updateTariffDto.rateType }),
        ...(updateTariffDto.energyRate !== undefined && { energyRate: updateTariffDto.energyRate }),
        ...(updateTariffDto.onPeakRate !== undefined && { onPeakRate: updateTariffDto.onPeakRate }),
        ...(updateTariffDto.offPeakRate !== undefined && { offPeakRate: updateTariffDto.offPeakRate }),
        ...(updateTariffDto.midPeakRate !== undefined && { midPeakRate: updateTariffDto.midPeakRate }),
        ...(updateTariffDto.demandRate !== undefined && { demandRate: updateTariffDto.demandRate }),
        ...(updateTariffDto.monthlyCharge !== undefined && { monthlyCharge: updateTariffDto.monthlyCharge }),
        ...(updateTariffDto.connectionFee !== undefined && { connectionFee: updateTariffDto.connectionFee }),
        ...(updateTariffDto.effectiveFrom && { effectiveFrom: new Date(updateTariffDto.effectiveFrom) }),
        ...(updateTariffDto.effectiveTo !== undefined && { 
          effectiveTo: updateTariffDto.effectiveTo ? new Date(updateTariffDto.effectiveTo) : null 
        }),
        ...(updateTariffDto.status && { status: updateTariffDto.status }),
        ...(updateTariffDto.metadata !== undefined && { metadata: updateTariffDto.metadata }),
        // Handle tier blocks update if provided
        ...(updateTariffDto.tierBlocks && {
          tierBlocks: {
            deleteMany: {},
            create: updateTariffDto.tierBlocks.map(block => ({
              blockNumber: block.blockNumber,
              fromKwh: block.fromKwh,
              toKwh: block.toKwh,
              rate: block.rate,
            })),
          },
        }),
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        tierBlocks: {
          orderBy: {
            blockNumber: 'asc',
          },
        },
      },
    });
  }

  async remove(id: number): Promise<void> {
    const organizationId = this.tenantService.getOrganizationId();

    // Verify the tariff exists and belongs to current organization
    const existingTariff = await this.prisma.tariffRate.findFirst({
      where: {
        id,
        client: {
          organizationId,
        },
      },
    });

    if (!existingTariff) {
      throw new NotFoundException('Tariff rate not found or access denied');
    }

    // Check if tariff is being used in any billing periods
    const billingPeriodsUsingTariff = await this.prisma.billingPeriod.count({
      where: {
        tariffRateId: id,
      },
    });

    if (billingPeriodsUsingTariff > 0) {
      throw new ConflictException('Cannot delete tariff that is used in billing periods');
    }

    await this.prisma.tariffRate.delete({
      where: { id },
    });
  }

  async getActiveTariffs(clientId?: number) {
    const organizationId = this.tenantService.getOrganizationId();
    const now = new Date();

    const where: any = {
      client: {
        organizationId,
      },
      status: TariffStatus.ACTIVE,
      effectiveFrom: { lte: now },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: now } },
      ],
    };

    if (clientId) {
      where.clientId = clientId;
    }

    return this.prisma.tariffRate.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        tierBlocks: {
          orderBy: {
            blockNumber: 'asc',
          },
        },
      },
      orderBy: [
        { name: 'asc' },
      ],
    });
  }

  async getTariffStats(clientId?: number) {
    const organizationId = this.tenantService.getOrganizationId();

    const where: any = {
      client: {
        organizationId,
      },
    };

    if (clientId) {
      where.clientId = clientId;
    }

    const [totalTariffs, tariffsByStatus, tariffsByType] = await Promise.all([
      this.prisma.tariffRate.count({ where }),
      this.prisma.tariffRate.groupBy({
        by: ['status'],
        where,
        _count: {
          id: true,
        },
      }),
      this.prisma.tariffRate.groupBy({
        by: ['rateType'],
        where,
        _count: {
          id: true,
        },
      }),
    ]);

    return {
      totalTariffs,
      tariffsByStatus: tariffsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      tariffsByType: tariffsByType.reduce((acc, item) => {
        acc[item.rateType] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  private validateRateTypeRequirements(tariffDto: CreateTariffDto): void {
    const { rateType, onPeakRate, offPeakRate, tierBlocks } = tariffDto;

    switch (rateType) {
      case RateType.TIME_OF_USE:
        if (!onPeakRate || !offPeakRate) {
          throw new BadRequestException('Time-of-Use tariffs require onPeakRate and offPeakRate');
        }
        break;

      case RateType.TIERED:
        if (!tierBlocks || tierBlocks.length === 0) {
          throw new BadRequestException('Tiered tariffs require at least one tier block');
        }
        
        // Validate tier block sequence
        const sortedBlocks = [...tierBlocks].sort((a, b) => a.blockNumber - b.blockNumber);
        for (let i = 0; i < sortedBlocks.length; i++) {
          const block = sortedBlocks[i];
          
          if (block.blockNumber !== i + 1) {
            throw new BadRequestException('Tier block numbers must be sequential starting from 1');
          }
          
          if (i > 0) {
            const prevBlock = sortedBlocks[i - 1];
            if (!prevBlock.toKwh || block.fromKwh !== prevBlock.toKwh) {
              throw new BadRequestException('Tier blocks must have contiguous kWh ranges');
            }
          }
        }
        break;
    }
  }
} 