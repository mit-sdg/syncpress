/**
 * The complete static-site composition. Concepts own state and invariants;
 * these declarations connect their actions and queries. Assembly discovers the
 * exports below, while PHASES in shared.ts determines execution order.
 */
export * as calculations from "./calculations.ts";
export * as collections from "./collections.ts";
export * as commanding from "./commanding.ts";
export * as deployment from "./deployment.ts";
export * as endpoints from "./endpoints.ts";
export * as excerpts from "./excerpts.ts";
export * as images from "./images.ts";
export * as inspection from "./inspection.ts";
export * as references from "./references.ts";
export * as render from "./render.ts";
export * as routes from "./routes.ts";
export * as serving from "./serving.ts";
export * as settings from "./settings.ts";
export * as sources from "./sources.ts";
export * as staging from "./staging.ts";
export * as views from "./views.ts";
export * as watching from "./watching.ts";
