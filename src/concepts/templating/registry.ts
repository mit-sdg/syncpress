import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidTrustedPath,
  InvalidTrustedValue,
  RecursiveTemplate,
  TemplateFailed,
  TemplateNotFound,
  TemplateSyntax,
  TemplatingConcept,
  UndefinedVariable,
  UnsupportedTemplate,
  UsedTemplateNotFound,
} from "./templating.ts";
import spec from "./spec.md" with { type: "text" };

export const templating = registerConcept({
  class: TemplatingConcept,
  spec,
  refusals: {
    INVALID_TRUSTED_PATH: InvalidTrustedPath,
    INVALID_TRUSTED_VALUE: InvalidTrustedValue,
    RECURSIVE_TEMPLATE: RecursiveTemplate,
    TEMPLATE_FAILED: TemplateFailed,
    TEMPLATE_NOT_FOUND: TemplateNotFound,
    TEMPLATE_SYNTAX: TemplateSyntax,
    UNDEFINED_VARIABLE: UndefinedVariable,
    UNSUPPORTED_TEMPLATE: UnsupportedTemplate,
    USED_TEMPLATE_NOT_FOUND: UsedTemplateNotFound,
  },
});
