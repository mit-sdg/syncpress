import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { RecursiveTemplate, TemplateFailed, TemplateNotFound, TemplateSyntax, TemplatingConcept, UsedTemplateNotFound } from "./templating.ts";
import spec from "./spec.md" with { type: "text" };

export const templating = registerConcept({
  class: TemplatingConcept,
  spec,
  refusals: {
    RECURSIVE_TEMPLATE: RecursiveTemplate,
    TEMPLATE_FAILED: TemplateFailed,
    TEMPLATE_NOT_FOUND: TemplateNotFound,
    TEMPLATE_SYNTAX: TemplateSyntax,
    USED_TEMPLATE_NOT_FOUND: UsedTemplateNotFound,
  },
});
