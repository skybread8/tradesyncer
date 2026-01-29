import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto, UpdateUserDto } from "./dto";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    try {
      console.log("[UsersService] Creating user with data:", {
        email: createUserDto.email,
        hasPassword: !!createUserDto.password,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
      });
      const user = await this.prisma.user.create({
        data: createUserDto,
      });
      console.log("[UsersService] User created successfully:", user.id);
      return user;
    } catch (error) {
      console.error("[UsersService] Error creating user:", error);
      console.error("[UsersService] Error code:", error.code);
      console.error("[UsersService] Error message:", error.message);
      throw error;
    }
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        tradingAccounts: true,
        copiers: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id); // Check if exists

    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check if exists
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
