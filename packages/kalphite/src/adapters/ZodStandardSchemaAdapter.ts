import type { ZodType } from "zod";
import type { StandardSchemaV1 } from "../types/StandardSchema";

/**
 * Adapter to convert Zod schemas into Standard Schema compliant schemas
 *
 * This follows the official Standard Schema specification from https://standardschema.dev/
 * Zod already implements Standard Schema natively in v3.24.0+, but this adapter
 * provides explicit compatibility and demonstrates the pattern.
 */
export function createZodStandardSchemaAdapter<T extends ZodType>(
  zodSchema: T
): StandardSchemaV1<T["_input"], T["_output"]> {
  return {
    "~standard": {
      version: 1,
      vendor: "zod",
      validate: (value: unknown) => {
        const result = zodSchema.safeParse(value);

        if (result.success) {
          return {
            value: result.data,
            // Success results should NOT have 'issues' property per Standard Schema spec
          };
        } else {
          return {
            issues: result.error.issues.map((issue) => ({
              message: issue.message,
              path: issue.path.length > 0 ? issue.path : undefined,
            })),
          };
        }
      },
      // types property is optional according to Standard Schema spec
      types: {
        input: {} as T["_input"],
        output: {} as T["_output"],
      },
    },
  };
}

/**
 * Helper function to check if a Zod schema already implements Standard Schema
 * (Zod v3.24.0+ has native support)
 */
export function isZodStandardSchemaCompliant(
  schema: any
): schema is StandardSchemaV1 {
  return (
    schema &&
    typeof schema === "object" &&
    "~standard" in schema &&
    typeof schema["~standard"] === "object" &&
    schema["~standard"].version === 1 &&
    typeof schema["~standard"].validate === "function"
  );
}

/**
 * Universal function to ensure any Zod schema is Standard Schema compliant
 */
export function ensureZodStandardSchema<T extends ZodType>(
  zodSchema: T
): StandardSchemaV1<T["_input"], T["_output"]> {
  // If already compliant (Zod v3.24.0+), return as-is
  if (isZodStandardSchemaCompliant(zodSchema)) {
    return zodSchema;
  }

  // Otherwise, wrap with our adapter
  return createZodStandardSchemaAdapter(zodSchema);
}
