import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
        ? exception.message
        : "Internal server error";

    console.error("[GlobalErrorHandler] ===== ERROR ===== ");
    console.error("[GlobalErrorHandler] Status:", status);
    console.error("[GlobalErrorHandler] Error:", exception);
    if (exception instanceof Error) {
      console.error("[GlobalErrorHandler] Stack:", exception.stack);
    }
    console.error("[GlobalErrorHandler] Request:", {
      method: request.method,
      url: request.url,
      body: JSON.stringify(request.body, null, 2),
    });
    
    // Log validation errors in detail
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        const exResponse = exceptionResponse as any;
        if (exResponse.errors) {
          console.error("[GlobalErrorHandler] Validation Errors:", JSON.stringify(exResponse.errors, null, 2));
        }
      }
    }

    const responseBody: any = {
      statusCode: status,
      message: typeof message === "string" ? message : (message as any).message || "Internal server error",
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Include error details if available (for validation errors, etc.)
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        const exResponse = exceptionResponse as any;
        if (exResponse.errors) {
          responseBody.errors = exResponse.errors;
        }
        if (exResponse.error) {
          responseBody.error = exResponse.error;
        }
      }
    }

    response.status(status).json(responseBody);
  }
}
