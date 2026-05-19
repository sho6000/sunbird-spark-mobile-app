export type OtpType = 'phone' | 'email';

export interface OtpGenerateRequest {
  request: {
    key: string;
    type: OtpType;
    captchaToken?: string;
    userId?: string;
  };
}

export interface OtpVerifyRequest {
  request: {
    key: string;
    type: OtpType;
    otp: string;
    userId?: string;
  };
}
