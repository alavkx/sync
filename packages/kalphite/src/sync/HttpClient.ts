import type {
  HttpClient,
  ModernSyncConfig,
  RequestOptions,
} from "../types/modern-sync";

export class HttpClientImpl implements HttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(config: ModernSyncConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.defaultHeaders = {
      "Content-Type": "application/json",
      "X-Client-Id": config.clientId,
      "X-User-Id": config.userId,
    };

    if (config.authToken) {
      this.defaultHeaders.Authorization = `Bearer ${config.authToken}`;
    }
  }

  async post<TRequest, TResponse>(
    endpoint: string,
    data: TRequest,
    options?: RequestOptions
  ): Promise<TResponse> {
    return this.request<TResponse>("POST", endpoint, data, options);
  }

  async get<TResponse>(
    endpoint: string,
    options?: RequestOptions
  ): Promise<TResponse> {
    return this.request<TResponse>("GET", endpoint, undefined, options);
  }

  private async request<TResponse>(
    method: string,
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<TResponse> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { ...this.defaultHeaders, ...options?.headers };

    const config: RequestInit = {
      method,
      headers,
      signal: options?.timeout
        ? AbortSignal.timeout(options.timeout)
        : undefined,
    };

    if (data !== undefined) {
      config.body = JSON.stringify(data);
    }

    let lastError: Error;
    const retries = options?.retries ?? 0;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, config);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        return result as TResponse;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on the last attempt
        if (attempt < retries) {
          await this.delay(this.getRetryDelay(attempt));
        }
      }
    }

    throw lastError!;
  }

  private getRetryDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, etc.
    return Math.min(1000 * Math.pow(2, attempt), 10000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
