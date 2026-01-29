import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";

/**
 * API Discovery Service
 * 
 * This service helps discover the correct API endpoints and authentication methods
 * by testing different configurations when documentation is not available.
 */
@Injectable()
export class ApiDiscoveryService {
  private readonly logger = new Logger("ApiDiscoveryService");

  /**
   * Discover API configuration by testing different endpoints and auth methods
   */
  async discoverApiConfig(
    accountNumber: string,
    email?: string,
    password?: string,
    apiKey?: string,
    apiSecret?: string,
    baseUrls: string[] = []
  ): Promise<{
    baseUrl?: string;
    authMethod?: string;
    authEndpoint?: string;
    accountEndpoint?: string;
    tradesEndpoint?: string;
    wsUrl?: string;
    errors: string[];
  }> {
    const errors: string[] = [];
    const defaultUrls = [
      // Common Rithmic URLs (fallback)
      "https://api.rithmic.com",
      "https://api.rithmic.com/v1",
      "https://rithmic.com/api",
      "https://rithmic.com/api/v1",
      // Firm-specific URLs (will be added by adapters)
      ...baseUrls,
    ];

    // Test each base URL
    for (const baseUrl of defaultUrls) {
      this.logger.log(`Testing base URL: ${baseUrl}`);

      // Test 1: Try email/password authentication (most common)
      if (email && password) {
        try {
          const result = await this.testEmailPasswordAuth(baseUrl, accountNumber, email, password);
          if (result.success) {
            this.logger.log(`✅ Found working email/password config at ${baseUrl}`);
            return {
              baseUrl,
              authMethod: "email_password",
              authEndpoint: result.authEndpoint,
              accountEndpoint: result.accountEndpoint,
              tradesEndpoint: result.tradesEndpoint,
              errors: [],
            };
          }
        } catch (error: any) {
          errors.push(`${baseUrl} (email/password): ${error.message}`);
        }
      }

      // Test 2: Try standard REST API authentication (username/password)
      if (password) {
        try {
          const result = await this.testStandardAuth(baseUrl, accountNumber, password);
          if (result.success) {
            this.logger.log(`✅ Found working configuration at ${baseUrl}`);
            return {
              baseUrl,
              authMethod: "username_password",
              authEndpoint: result.authEndpoint,
              accountEndpoint: result.accountEndpoint,
              tradesEndpoint: result.tradesEndpoint,
              errors: [],
            };
          }
        } catch (error: any) {
          errors.push(`${baseUrl}: ${error.message}`);
          this.logger.debug(`Failed ${baseUrl}: ${error.message}`);
        }
      }

      // Test 3: Try API Key in header
      if (apiKey && apiSecret) {
        try {
          const result = await this.testApiKeyAuth(baseUrl, accountNumber, apiKey, apiSecret);
          if (result.success) {
            this.logger.log(`✅ Found working API Key auth at ${baseUrl}`);
            return {
              baseUrl,
              authMethod: "api_key",
              authEndpoint: result.authEndpoint,
              accountEndpoint: result.accountEndpoint,
              tradesEndpoint: result.tradesEndpoint,
              errors: [],
            };
          }
        } catch (error: any) {
          errors.push(`${baseUrl} (API Key): ${error.message}`);
        }
      }
    }

    this.logger.warn("Could not discover API configuration automatically");
    return {
      errors,
    };
  }

  /**
   * Test email/password authentication
   */
  private async testEmailPasswordAuth(
    baseUrl: string,
    accountNumber: string,
    email: string,
    password: string
  ): Promise<any> {
    const client = axios.create({
      baseURL: baseUrl,
      timeout: 5000,
    });

    const authEndpoints = [
      "/auth/login",
      "/api/auth/login",
      "/v1/auth/login",
      "/login",
      "/api/login",
      "/authenticate",
    ];

    for (const endpoint of authEndpoints) {
      try {
        const response = await client.post(
          endpoint,
          {
            email,
            password,
            accountNumber,
            username: accountNumber, // Some APIs use username instead of accountNumber
          },
          {
            validateStatus: () => true,
          }
        );

        if (response.status === 200 || response.status === 201) {
          return {
            success: true,
            authEndpoint: endpoint,
            accountEndpoint: `/accounts/${accountNumber}`,
            tradesEndpoint: `/accounts/${accountNumber}/trades`,
          };
        }
      } catch (error) {
        // Continue to next endpoint
      }
    }

    throw new Error("Email/password auth not found");
  }

  /**
   * Test standard username/password authentication
   */
  private async testStandardAuth(
    baseUrl: string,
    accountNumber: string,
    password: string
  ): Promise<any> {
    const client = axios.create({
      baseURL: baseUrl,
      timeout: 5000,
    });

    const authEndpoints = [
      "/auth/login",
      "/api/auth/login",
      "/v1/auth/login",
      "/login",
      "/api/login",
      "/authenticate",
    ];

    for (const endpoint of authEndpoints) {
      try {
        const response = await client.post(
          endpoint,
          {
            username: accountNumber,
            password: password,
            accountNumber,
          },
          {
            validateStatus: () => true, // Don't throw on any status
          }
        );

        // If we get a 200 or 201, it might be working
        if (response.status === 200 || response.status === 201) {
          return {
            success: true,
            authEndpoint: endpoint,
            accountEndpoint: `/accounts/${accountNumber}`,
            tradesEndpoint: `/accounts/${accountNumber}/trades`,
          };
        }
      } catch (error) {
        // Continue to next endpoint
      }
    }

    throw new Error("Standard auth not found");
  }

  /**
   * Test API Key in header authentication
   */
  private async testApiKeyAuth(
    baseUrl: string,
    accountNumber: string,
    apiKey: string,
    apiSecret: string
  ): Promise<any> {
    const client = axios.create({
      baseURL: baseUrl,
      timeout: 5000,
      headers: {
        "X-API-Key": apiKey,
        "X-API-Secret": apiSecret,
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    const accountEndpoints = [
      `/accounts/${accountNumber}`,
      `/api/accounts/${accountNumber}`,
      `/v1/accounts/${accountNumber}`,
      `/account/${accountNumber}`,
    ];

    for (const endpoint of accountEndpoints) {
      try {
        const response = await client.get(endpoint, {
          validateStatus: () => true,
        });

        if (response.status === 200) {
          return {
            success: true,
            authEndpoint: null, // No separate auth endpoint
            accountEndpoint: endpoint,
            tradesEndpoint: `${endpoint}/trades`,
          };
        }
      } catch (error) {
        // Continue
      }
    }

    throw new Error("API Key auth not found");
  }

  /**
   * Test WebSocket connection
   */
  async discoverWebSocketUrl(
    baseUrl: string,
    token?: string
  ): Promise<string | null> {
    const wsUrls = [
      baseUrl.replace("https://", "wss://").replace("http://", "ws://"),
      baseUrl.replace("https://", "wss://").replace("http://", "ws://") + "/ws",
      baseUrl.replace("https://", "wss://").replace("http://", "ws://") + "/websocket",
      "wss://ws.rithmic.com",
      "wss://ws.topstepx.com",
    ];

    // Note: WebSocket testing would require actual connection
    // For now, return the most likely URL
    return wsUrls[0] || null;
  }
}
