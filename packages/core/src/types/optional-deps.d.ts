// Ambient declarations for OPTIONAL runtime dependencies.
//
// telemetry (OpenTelemetry), the browser tool (playwright) and the
// desktop-control tool (@nut-tree-fork/nut-js) are optional features — they are
// loaded with `await import(...)` only when used and are intentionally NOT in
// package.json dependencies, so a base install stays lean. Without these
// declarations `tsc --noEmit` errors with TS2307 ("cannot find module") on the
// dynamic imports even though the code already guards their absence at runtime.
// Declaring them here resolves the import types to `any` when the package is not
// installed; if a user installs the real package, its own types take precedence.

declare module '@opentelemetry/sdk-node';
declare module '@opentelemetry/resources';
declare module '@opentelemetry/semantic-conventions';
declare module '@opentelemetry/exporter-trace-otlp-http';
declare module '@opentelemetry/sdk-trace-base';
declare module '@opentelemetry/api';
declare module 'playwright';
declare module '@nut-tree-fork/nut-js';
