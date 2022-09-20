import { createAssessment } from './reCaptcha';
import { NextApiRequest } from 'next';

type AllowAllConfig = {
    type: 'allowAll';
}

type ReCaptchaConfig = {
    type: 'reCaptcha';
    reCaptchaProjectId: string;
    reCaptchaSiteKey: string;
    reCaptchaMinScore: number;
}

export type ReturnSignatureConfigField = AllowAllConfig | ReCaptchaConfig;

export async function isReturnedSignatureAllowed(
    request: NextApiRequest,
    config: ReturnSignatureConfigField,
): Promise<boolean> {
    if (config.type === 'allowAll') {
        return true;
    }
    if (config.type == 'reCaptcha') {
        const reCaptchaToken = request.body?.reCaptchaToken;
        if (typeof reCaptchaToken !== 'string') {
            return false;
        }
        const reCaptchaAssessment = await createAssessment(
            config.reCaptchaProjectId,
            process.env.RECAPTCHA_API_KEY!,
            reCaptchaToken,
            config.reCaptchaSiteKey,
            'octane'
        );
        if (!reCaptchaAssessment.tokenProperties.valid) {
            return false;
        }
        return reCaptchaAssessment.riskAnalysis.score >= config.reCaptchaMinScore;
    }
    return true;
}
