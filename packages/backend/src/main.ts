import { NestFactory } from "@nestjs/core";
import { ValidationPipe, HttpException, HttpStatus } from "@nestjs/common";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  });

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false, // Changed to false to allow extra fields (they'll be stripped anyway)
      transformOptions: {
        enableImplicitConversion: true, // Automatically convert strings to numbers, etc.
      },
      exceptionFactory: (errors) => {
        console.error("[ValidationPipe] Validation errors:", JSON.stringify(errors, null, 2));
        const errorMessages = errors.map((error) => {
          const constraints = error.constraints || {};
          return {
            property: error.property,
            value: error.value,
            constraints: Object.values(constraints),
          };
        });
        return new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: "Validation failed",
            errors: errorMessages,
          },
          HttpStatus.BAD_REQUEST
        );
      },
    })
  );

  // Global prefix
  app.setGlobalPrefix("api");

  const port = process.env.PORT || 4000;
  await app.listen(port);

  console.log(`🚀 TradeSyncer API running on http://localhost:${port}/api`);
}

bootstrap();
