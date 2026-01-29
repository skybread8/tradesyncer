import { Controller, Post, Body, UseGuards, Get, Request } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto, LoginDto } from "./dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { Public } from "./decorators/public.decorator";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post("register")
  async register(@Body() registerDto: RegisterDto) {
    try {
      console.log("[AuthController] Register request received:", {
        email: registerDto.email,
        hasPassword: !!registerDto.password,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      });
      const result = await this.authService.register(registerDto);
      console.log("[AuthController] Register successful for:", registerDto.email);
      return result;
    } catch (error) {
      console.error("[AuthController] Register error:", error);
      console.error("[AuthController] Error stack:", error.stack);
      throw error;
    }
  }

  @Public()
  @Post("login")
  async login(@Body() loginDto: LoginDto) {
    try {
      console.log("[AuthController] Login request received:", {
        email: loginDto.email,
        hasPassword: !!loginDto.password,
      });
      const result = await this.authService.login(loginDto);
      console.log("[AuthController] Login successful for:", loginDto.email);
      return result;
    } catch (error) {
      console.error("[AuthController] Login error:", error);
      console.error("[AuthController] Error message:", error.message);
      if (error.stack) {
        console.error("[AuthController] Error stack:", error.stack);
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getProfile(@Request() req) {
    return req.user;
  }
}
