import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantService } from '../../common/services/tenant.service';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { UpdateMeterReadingDto } from './dto/update-meter-reading.dto';
import { BulkMeterReadingImportDto, BulkImportResultDto } from './dto/bulk-import.dto';
import { MeterReading, ReadingType } from '@prisma/client';

@Injectable()
export class MeterReadingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  async create(createMeterReadingDto: CreateMeterReadingDto): Promise<MeterReading> {
    const organizationId = this.tenantService.getOrganizationId();

    // Verify customer exists and belongs to current organization
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: createMeterReadingDto.customerId,
        client: {
          organizationId,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found or access denied');
    }

    // Check for duplicate readings (same customer, meter, date, and type)
    const existingReading = await this.prisma.meterReading.findFirst({
      where: {
        customerId: createMeterReadingDto.customerId,
        meterNumber: createMeterReadingDto.meterNumber,
        readingDate: new Date(createMeterReadingDto.readingDate),
        readingType: createMeterReadingDto.readingType,
      },
    });

    if (existingReading) {
      throw new ConflictException(
        `Meter reading already exists for customer ${createMeterReadingDto.customerId} on ${createMeterReadingDto.readingDate} for ${createMeterReadingDto.readingType}`
      );
    }

    return this.prisma.meterReading.create({
      data: {
        meterNumber: createMeterReadingDto.meterNumber,
        readingDate: new Date(createMeterReadingDto.readingDate),
        readingValue: createMeterReadingDto.readingValue,
        readingType: createMeterReadingDto.readingType,
        demandReading: createMeterReadingDto.demandReading,
        metadata: createMeterReadingDto.metadata,
        customer: {
          connect: { id: createMeterReadingDto.customerId },
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
      },
    });
  }

  async findAll(customerId?: number, startDate?: string, endDate?: string, readingType?: ReadingType) {
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

    if (startDate || endDate) {
      where.readingDate = {};
      if (startDate) {
        where.readingDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.readingDate.lte = new Date(endDate);
      }
    }

    if (readingType) {
      where.readingType = readingType;
    }

    return this.prisma.meterReading.findMany({
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
      },
      orderBy: [
        { readingDate: 'desc' },
        { customer: { name: 'asc' } },
      ],
    });
  }

  async findOne(id: number): Promise<MeterReading> {
    const organizationId = this.tenantService.getOrganizationId();

    const meterReading = await this.prisma.meterReading.findFirst({
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
      },
    });

    if (!meterReading) {
      throw new NotFoundException('Meter reading not found or access denied');
    }

    return meterReading;
  }

  async update(id: number, updateMeterReadingDto: UpdateMeterReadingDto): Promise<MeterReading> {
    const organizationId = this.tenantService.getOrganizationId();

    // Verify the meter reading exists and belongs to current organization
    const existingReading = await this.prisma.meterReading.findFirst({
      where: {
        id,
        customer: {
          client: {
            organizationId,
          },
        },
      },
    });

    if (!existingReading) {
      throw new NotFoundException('Meter reading not found or access denied');
    }

    // Check for duplicate if readingDate or readingType is being updated
    if (updateMeterReadingDto.readingDate || updateMeterReadingDto.readingType) {
      const checkDate = updateMeterReadingDto.readingDate 
        ? new Date(updateMeterReadingDto.readingDate)
        : existingReading.readingDate;
      const checkType = updateMeterReadingDto.readingType || existingReading.readingType;

      const duplicateReading = await this.prisma.meterReading.findFirst({
        where: {
          customerId: existingReading.customerId,
          readingDate: checkDate,
          readingType: checkType,
          id: { not: id }, // Exclude current reading
        },
      });

      if (duplicateReading) {
        throw new ConflictException(
          `Another meter reading already exists for this customer on ${checkDate.toISOString().split('T')[0]} for ${checkType}`
        );
      }
    }

    return this.prisma.meterReading.update({
      where: { id },
      data: {
        ...updateMeterReadingDto,
        ...(updateMeterReadingDto.readingDate && {
          readingDate: new Date(updateMeterReadingDto.readingDate),
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
      },
    });
  }

  async remove(id: number): Promise<void> {
    const organizationId = this.tenantService.getOrganizationId();

    // Verify the meter reading exists and belongs to current organization
    const existingReading = await this.prisma.meterReading.findFirst({
      where: {
        id,
        customer: {
          client: {
            organizationId,
          },
        },
      },
    });

    if (!existingReading) {
      throw new NotFoundException('Meter reading not found or access denied');
    }

    await this.prisma.meterReading.delete({
      where: { id },
    });
  }

  async bulkImport(bulkImportDto: BulkMeterReadingImportDto): Promise<BulkImportResultDto> {
    const { readings, options = {} } = bulkImportDto;
    const result: BulkImportResultDto = {
      success: false,
      totalCount: readings.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
      processedReadings: [],
    };

    if (options.validateOnly) {
      // Validation-only mode
      for (let i = 0; i < readings.length; i++) {
        try {
          await this.validateMeterReading(readings[i]);
        } catch (error) {
          result.errors.push({
            index: i,
            error: error.message,
            data: readings[i],
          });
          result.errorCount++;
        }
      }
      result.successCount = result.totalCount - result.errorCount;
      result.success = result.errorCount === 0;
      return result;
    }

    // Process readings
    for (let i = 0; i < readings.length; i++) {
      try {
        const reading = readings[i];
        
        // Apply default reading type if not specified
        if (!reading.readingType && options.defaultReadingType) {
          reading.readingType = options.defaultReadingType;
        }

        // Check for duplicates if skipDuplicates is enabled
        if (options.skipDuplicates) {
          const existingReading = await this.prisma.meterReading.findFirst({
            where: {
              customerId: reading.customerId,
              readingDate: new Date(reading.readingDate),
              readingType: reading.readingType,
            },
          });

          if (existingReading) {
            continue; // Skip duplicate
          }
        }

        const createdReading = await this.create({
          ...reading,
          notes: reading.notes || options.notes,
        });

        result.processedReadings!.push(createdReading.id);
        result.successCount++;
      } catch (error) {
        result.errors.push({
          index: i,
          error: error.message,
          data: readings[i],
        });
        result.errorCount++;
      }
    }

    result.success = result.errorCount === 0;
    return result;
  }

  async getCustomerReadings(customerId: number, limit: number = 50) {
    const organizationId = this.tenantService.getOrganizationId();

    // Verify customer exists and belongs to current organization
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        client: {
          organizationId,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found or access denied');
    }

    return this.prisma.meterReading.findMany({
      where: { customerId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            accountNumber: true,
          },
        },
      },
      orderBy: { readingDate: 'desc' },
      take: limit,
    });
  }

  async getReadingStats(customerId?: number) {
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

    const [totalReadings, readingsByType] = await Promise.all([
      this.prisma.meterReading.count({ where }),
      this.prisma.meterReading.groupBy({
        by: ['readingType'],
        where,
        _count: {
          id: true,
        },
      }),
    ]);

    return {
      totalReadings,
      readingsByType: readingsByType.reduce((acc, item) => {
        acc[item.readingType] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  private async validateMeterReading(reading: CreateMeterReadingDto): Promise<void> {
    const organizationId = this.tenantService.getOrganizationId();

    // Verify customer exists
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: reading.customerId,
        client: {
          organizationId,
        },
      },
    });

    if (!customer) {
      throw new BadRequestException(`Customer ${reading.customerId} not found or access denied`);
    }

    // Check reading value is positive
    if (reading.readingValue <= 0) {
      throw new BadRequestException('Reading value must be positive');
    }

    // Check demand reading is positive if provided
    if (reading.demandReading !== undefined && reading.demandReading <= 0) {
      throw new BadRequestException('Demand reading must be positive');
    }

    // Check date is not in the future
    const readingDate = new Date(reading.readingDate);
    if (readingDate > new Date()) {
      throw new BadRequestException('Reading date cannot be in the future');
    }
  }
} 