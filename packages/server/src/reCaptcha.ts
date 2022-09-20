import axios from "axios";

type Event = {
    token: string;
    siteKey: string;
    userAgent: string;
    userIpAddress: string;
    expectedAction: string;
    hashedAccountId: string;
}

type RiskAnalysis = {
    score: number;
    reasons: string[];
}

type TokenProperties = {
    valid: boolean;
    invalidReason: string;
    hostname: string;
    action: string;
    createTime: string;
}

type Assessment = {
    name: string;
    event: Event;
    riskAnalysis: RiskAnalysis;
    tokenProperties: TokenProperties;
}

export async function createAssessment(
    projectId: string,
    apiKey: string,
    token: string,
    key: string,
    expectedAction: string,
): Promise<Assessment> {
    const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`;
    const response = (await axios.post(url, {
        event: {
            token: token,
            siteKey: key,
            expectedAction: expectedAction,
        }
    })).data;
    return response as Assessment;
}
