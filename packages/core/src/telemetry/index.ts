/**
 * telemetry.ts — OpenTelemetry observability for AiDE
 *
 * Instruments agent loops, tool calls, and LLM requests with spans and metrics.
 * Exports to OTLP (Jaeger, Tempo, Honeycomb, etc.) or console.
 *
 * Usage:
 *   const tel = new Telemetry({ serviceName: 'aide', exporterUrl: 'http://localhost:4318' });
 *   tel.init();
 *   const span = tel.startSpan('agent.run', { sessionId });
 *   // ... work ...
 *   span.end();
 */

import { EventEmitter } from 'node:events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TelemetryOptions {
  serviceName?: string;
  serviceVersion?: string;
  /** OTLP HTTP endpoint. If omitted, logs to console. */
  exporterUrl?: string;
  /** Whether to enable telemetry. Default true. */
  enabled?: boolean;
}

export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined;
}

export interface TelemetrySpan {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: 'ok' | 'error', message?: string): void;
  recordException(err: Error): void;
  end(): void;
}

export interface AgentMetrics {
  totalRuns: number;
  totalIterations: number;
  totalToolCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCacheHits: number;
  errorCount: number;
  avgIterationsPerRun: number;
}

// ---------------------------------------------------------------------------
// Telemetry
// ---------------------------------------------------------------------------

export class Telemetry extends EventEmitter {
  private readonly options: Required<TelemetryOptions>;
  private metrics: AgentMetrics = {
    totalRuns: 0,
    totalIterations: 0,
    totalToolCalls: 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCacheHits: 0,
    errorCount: 0,
    avgIterationsPerRun: 0,
  };
  private spans: Map<string, InternalSpan> = new Map();
  private otelAvailable = false;
  private tracer: unknown = null;

  constructor(options: TelemetryOptions = {}) {
    super();
    this.options = {
      serviceName: options.serviceName ?? 'aide',
      serviceVersion: options.serviceVersion ?? '0.1.0',
      exporterUrl: options.exporterUrl ?? '',
      enabled: options.enabled ?? true,
    };
  }

  async init(): Promise<void> {
    if (!this.options.enabled) return;
    try {
      const { NodeSDK } = await import('@opentelemetry/sdk-node');
      const { Resource } = await import('@opentelemetry/resources');
      const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } = await import('@opentelemetry/semantic-conventions');
      const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
      const { SimpleSpanProcessor } = await import('@opentelemetry/sdk-trace-base');
      const { trace } = await import('@opentelemetry/api');

      const exporter = this.options.exporterUrl
        ? new OTLPTraceExporter({ url: `${this.options.exporterUrl}/v1/traces` })
        : null;

      const sdk = new NodeSDK({
        resource: new Resource({
          [SEMRESATTRS_SERVICE_NAME]: this.options.serviceName,
          [SEMRESATTRS_SERVICE_VERSION]: this.options.serviceVersion,
        }),
        ...(exporter ? { spanProcessor: new SimpleSpanProcessor(exporter) } : {}),
      });

      sdk.start();
      this.tracer = trace.getTracer(this.options.serviceName);
      this.otelAvailable = true;
    } catch {
      // OpenTelemetry not installed — fall back to console logging
    }
  }

  startSpan(name: string, attributes: SpanAttributes = {}): TelemetrySpan {
    const id = `${name}-${Date.now()}`;
    const span = new InternalSpan(name, attributes, this.otelAvailable ? this.tracer : null);
    this.spans.set(id, span);
    span.on('end', () => {
      this.spans.delete(id);
      if (this.options.exporterUrl === '' && this.options.enabled) {
        // Console fallback
        const dur = span.getDurationMs();
        const status = span.getStatus();
        console.log(`[AIDE TRACE] ${name} ${status} ${dur}ms`, attributes);
      }
    });
    return span;
  }

  // -------------------------------------------------------------------------
  // Metrics tracking (no external dependency)
  // -------------------------------------------------------------------------

  recordRun(): void { this.metrics.totalRuns++; }
  recordIteration(): void { this.metrics.totalIterations++; }
  recordToolCall(): void { this.metrics.totalToolCalls++; }
  recordTokens(input: number, output: number): void {
    this.metrics.totalTokensIn += input;
    this.metrics.totalTokensOut += output;
  }
  recordCacheHit(): void { this.metrics.totalCacheHits++; }
  recordError(): void { this.metrics.errorCount++; }

  getMetrics(): AgentMetrics {
    return {
      ...this.metrics,
      avgIterationsPerRun: this.metrics.totalRuns > 0
        ? Math.round(this.metrics.totalIterations / this.metrics.totalRuns * 10) / 10
        : 0,
    };
  }

  resetMetrics(): void {
    this.metrics = {
      totalRuns: 0, totalIterations: 0, totalToolCalls: 0,
      totalTokensIn: 0, totalTokensOut: 0, totalCacheHits: 0,
      errorCount: 0, avgIterationsPerRun: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Internal span implementation
// ---------------------------------------------------------------------------

class InternalSpan extends EventEmitter implements TelemetrySpan {
  private startTime = Date.now();
  private endTime = 0;
  private status: 'ok' | 'error' = 'ok';
  private statusMessage = '';
  private attributes: SpanAttributes;
  private otelSpan: unknown = null;

  constructor(name: string, attributes: SpanAttributes, tracer: unknown) {
    super();
    this.attributes = { ...attributes };
    if (tracer) {
      try {
        this.otelSpan = (tracer as any).startSpan(name, { attributes });
      } catch { /* ignore */ }
    }
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.attributes[key] = value;
    if (this.otelSpan) (this.otelSpan as any).setAttribute(key, value);
  }

  setStatus(status: 'ok' | 'error', message?: string): void {
    this.status = status;
    this.statusMessage = message ?? '';
    if (this.otelSpan) {
      const { SpanStatusCode } = require('@opentelemetry/api');
      (this.otelSpan as any).setStatus({
        code: status === 'ok' ? SpanStatusCode.OK : SpanStatusCode.ERROR,
        message,
      });
    }
  }

  recordException(err: Error): void {
    if (this.otelSpan) (this.otelSpan as any).recordException(err);
  }

  end(): void {
    this.endTime = Date.now();
    if (this.otelSpan) (this.otelSpan as any).end();
    this.emit('end');
  }

  getDurationMs(): number { return this.endTime - this.startTime; }
  getStatus(): string { return this.status; }
}

export const globalTelemetry = new Telemetry();
