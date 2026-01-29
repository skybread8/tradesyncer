import { IsString, IsEnum, IsOptional, IsEmail, ValidateIf, Validate } from "class-validator";
import { TradingFirm, Platform } from "@prisma/client";
import { registerDecorator, ValidationOptions, ValidationArguments } from "class-validator";

/**
 * Custom validator: At least one authentication method must be provided
 * (email/password OR apiKey/apiSecret)
 */
function HasValidCredentials(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: "hasValidCredentials",
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments): boolean {
          const obj = args.object as ConnectPlatformDto;
          // At least one authentication method must be provided
          // For Tradovate and some platforms, email can be username
          const hasEmailPassword = !!(obj.email && obj.password);
          const hasApiKeySecret = !!(obj.apiKey && obj.apiSecret);
          // Some platforms (Rithmic) can use accountNumber + password
          const hasAccountNumberPassword = !!(obj.accountNumber && obj.password && !obj.email);
          return hasEmailPassword || hasApiKeySecret || hasAccountNumberPassword;
        },
        defaultMessage(args: ValidationArguments): string {
          return "Debes proporcionar email/usuario+contraseña, número de cuenta+contraseña, o API Key/Secret";
        },
      },
    });
  };
}

export class ConnectPlatformDto {
  @IsEnum(TradingFirm)
  firm: TradingFirm;

  @IsEnum(Platform)
  platform: Platform;

  /**
   * Email/Username/Password authentication
   * Required for: ProjectX (TopStepX), Tradovate (accepts username OR email), some Rithmic-based platforms
   * NOT required for: NinjaTrader (uses API Key/Secret primarily), some Rithmic platforms (use account number)
   * 
   * Note: For Tradovate, this field can be either email OR username (both work)
   */
  @ValidateIf((o) => !o.apiKey || !o.apiSecret)
  @IsOptional()
  @IsString() // Changed from IsEmail to IsString to allow username for Tradovate
  email?: string; // Can be email OR username depending on platform

  @ValidateIf((o) => o.email && (!o.apiKey || !o.apiSecret))
  @IsOptional()
  @IsString()
  password?: string;

  /**
   * API Key/Secret authentication
   * Required for: NinjaTrader (primary method), some platforms as alternative
   * NOT required for: Most platforms that use email/password
   */
  @ValidateIf((o) => !o.email || !o.password)
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ValidateIf((o) => o.apiKey && (!o.email || !o.password))
  @IsOptional()
  @IsString()
  apiSecret?: string;

  /**
   * Account Number (optional, used by some Rithmic-based platforms)
   * Some platforms use account number + password instead of email + password
   */
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @Validate(HasValidCredentials)
  _hasCredentials?: boolean; // Virtual property for validation
}
