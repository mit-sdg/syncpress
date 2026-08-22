import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidTrustedPath,
  InvalidTemplateOrigin,
  InvalidTrustedValue,
  RecursiveTemplate,
  TemplateFailed,
  TemplateNotFound,
  TemplateNameTaken,
  TemplateSyntax,
  TemplatingConcept,
  UndefinedVariable,
  UnsupportedTemplate,
  UsedTemplateNotFound,
} from "./templating.ts";
import spec from "@design/concepts/Templating.md" with { type: "text" };

export const templating = registerConcept({
  class: TemplatingConcept,
  spec,
  refusals: {
    INVALID_TRUSTED_PATH: InvalidTrustedPath,
    INVALID_TEMPLATE_ORIGIN: InvalidTemplateOrigin,
    INVALID_TRUSTED_VALUE: InvalidTrustedValue,
    RECURSIVE_TEMPLATE: RecursiveTemplate,
    TEMPLATE_FAILED: TemplateFailed,
    TEMPLATE_NOT_FOUND: TemplateNotFound,
    TEMPLATE_NAME_TAKEN: TemplateNameTaken,
    TEMPLATE_SYNTAX: TemplateSyntax,
    UNDEFINED_VARIABLE: UndefinedVariable,
    UNSUPPORTED_TEMPLATE: UnsupportedTemplate,
    USED_TEMPLATE_NOT_FOUND: UsedTemplateNotFound,
  },
});
