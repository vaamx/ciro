import { IsString, IsOptional, IsArray, ValidateNested, IsObject, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

// Size options for widgets
export enum WidgetSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  FULL = 'full'
}

// Types of widgets
export enum WidgetType {
  CHART = 'chart',
  TABLE = 'table',
  METRIC = 'metric',
  TEXT = 'text',
  LIST = 'list'
}

// Metric types
export enum MetricType {
  NUMBER = 'number',
  CURRENCY = 'currency',
  PERCENTAGE = 'percentage'
}

// Timeframe options
export enum TimeframeType {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year'
}

// Base DTO for creating and updating dashboards
export class BaseDashboardDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  team?: string;

  @IsString()
  @IsOptional()
  category?: string;
}

// DTO for creating a new dashboard
export class CreateDashboardDto extends BaseDashboardDto {
  @IsString()
  name!: string;

  @IsNumber()
  @IsOptional()
  organization_id?: number;
}

// DTO for updating an existing dashboard
export class UpdateDashboardDto extends BaseDashboardDto {
  @IsString()
  @IsOptional()
  name?: string;
}

// DTO for widget configuration
export class WidgetDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsEnum(WidgetType)
  widget_type!: WidgetType;

  @IsString()
  title!: string;

  @IsEnum(WidgetSize)
  size!: WidgetSize;

  @IsNumber()
  position!: number;

  @IsObject()
  settings!: Record<string, any>;
}

// DTO for update widgets request
export class UpdateWidgetsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WidgetDto)
  widgets!: WidgetDto[];
}

// DTO for metric configuration
export class MetricDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  title!: string;

  @IsNumber()
  value!: number;

  @IsEnum(MetricType)
  type!: MetricType;

  @IsEnum(TimeframeType)
  timeframe!: TimeframeType;

  @IsObject()
  @IsOptional()
  trend?: Record<string, any>;
}

// DTO for update metrics request
export class UpdateMetricsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetricDto)
  metrics!: MetricDto[];
}

// DTO for dashboard response
export class DashboardResponseDto {
  id!: string | number;
  name!: string;
  description?: string;
  team?: string;
  category?: string;
  created_by!: string | number;
  organization_id!: number;
  created_at!: Date;
  updated_at!: Date;
  widgets!: WidgetDto[];
  metrics!: MetricDto[];
} 