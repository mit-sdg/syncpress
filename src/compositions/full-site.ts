/**
 * The complete static-site composition. Concepts own state and invariants;
 * these declarations connect their actions and queries. Assembly discovers the
 * exports below, while PHASES in shared.ts determines execution order.
 */
export * from "./endpoints.ts";
export * from "./settings.ts";
export * from "./sources.ts";
export * from "./routes.ts";
export * from "./excerpts.ts";
export * from "./collections.ts";
export * from "./render.ts";
export * from "./references.ts";
export * from "./images.ts";
export * from "./deployment.ts";
export * from "./views.ts";
