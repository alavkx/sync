import type { HttpClient, OperationSyncConfig } from "../types/operation-sync";

export class HttpClientImpl implements HttpClient {
  private config: OperationSyncConfig;

  constructor(config: OperationSyncConfig) {
    this.config = config;
  }

  async post<TRequest, TResponse>(
    endpoint: string,
    data: TRequest
  ): Promise<TResponse> {
    const url = new URL(endpoint, this.config.baseUrl).toString();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.authToken && {
          Authorization: `Bearer ${this.config.authToken}`,
        }),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}
