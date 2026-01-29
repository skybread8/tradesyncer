import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";
import { RegisterDto, LoginDto } from "./dto";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const { password: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    const payload = { email: user.email, sub: user.id, role: user.role };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    try {
      console.log("[AuthService] Starting registration for:", registerDto.email);
      
      // Check if user already exists
      const existingUser = await this.usersService.findByEmail(registerDto.email);
      if (existingUser) {
        throw new ConflictException("User with this email already exists");
      }

      console.log("[AuthService] Hashing password...");
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);
      
      console.log("[AuthService] Creating user in database...");
      const user = await this.usersService.create({
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      });

      console.log("[AuthService] User created successfully:", user.id);
      
      const { password: _, ...userWithoutPassword } = user;
      const payload = { email: user.email, sub: user.id, role: user.role };

      console.log("[AuthService] Generating JWT token...");
      const access_token = this.jwtService.sign(payload);

      return {
        access_token,
        user: userWithoutPassword,
      };
    } catch (error) {
      console.error("[AuthService] Registration error:", error);
      console.error("[AuthService] Error message:", error.message);
      if (error.stack) {
        console.error("[AuthService] Error stack:", error.stack);
      }
      // Si ya es una HttpException, la relanzamos tal cual
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      // Para otros errores (como errores de Prisma), los convertimos en BadRequestException
      if (error.code === "P2002") {
        // Prisma unique constraint violation
        throw new ConflictException("User with this email already exists");
      }
      throw new BadRequestException(error.message || "Registration failed");
    }
  }

  async verifyToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
