import { AppSystemConfig, AppSystemOperationConfig } from '@/app/core/config/app-config.service';
import { PixGenerationResponse } from '@/app/pages/service/pix.service';

export interface PixComponentSelection {
    system: AppSystemConfig | null;
    operation: AppSystemOperationConfig | null;
}

export interface PixGeneratedResult {
    referenceLabel: string;
    referenceValue: string;
    payment: PixGenerationResponse;
    system: AppSystemConfig;
    operation: AppSystemOperationConfig;
}
