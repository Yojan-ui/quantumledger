import { openApi } from "@/lib/server/openapi";

type Schema = {
  type?: string | string[];
  enum?: unknown[];
  default?: unknown;
  properties?: Record<string, Schema>;
  required?: string[];
  description?: string;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
};

function typeOf(s: Schema): string {
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(" | ");
  return Array.isArray(s.type) ? s.type.join(" | ") : (s.type ?? "any");
}

/** The API reference, rendered from the generated OpenAPI document (the zod schemas the routes use). */
export function ApiReference() {
  const doc = openApi();
  const ops = Object.entries(doc.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, op]) => ({
      path,
      method,
      op: op as {
        summary: string;
        tags: string[];
        parameters: { name: string; in: string; required: boolean; schema: Schema }[];
        requestBody?: { content: { "application/json": { schema: Schema } } };
      },
    })),
  );
  const tags = [...new Set(ops.map((o) => o.op.tags[0]!))];
  return (
    <div className="mt-8 space-y-12">
      {tags.map((tag) => (
        <section key={tag}>
          <h2
            id={tag.toLowerCase().replace(/\W+/g, "-")}
            className="scroll-mt-24 text-h2 font-medium text-fg"
          >
            {tag}
          </h2>
          <div className="mt-4 border-b border-line">
            {ops
              .filter((o) => o.op.tags[0] === tag)
              .map(({ path, method, op }) => {
                const body = op.requestBody?.content["application/json"].schema;
                const fields = [
                  ...op.parameters.map((p) => ({
                    name: p.name,
                    where: p.in,
                    required: p.required,
                    s: p.schema,
                  })),
                  ...Object.entries(body?.properties ?? {}).map(([name, s]) => ({
                    name,
                    where: "body",
                    required: !!body?.required?.includes(name) && s.default === undefined,
                    s,
                  })),
                ];
                return (
                  <div key={`${method} ${path}`} className="border-t border-line py-5">
                    <p className="font-mono text-small text-fg">
                      <span className="mr-3 inline-block w-12 uppercase text-fg-3">{method}</span>
                      {path}
                    </p>
                    <p className="mt-1 pl-14 text-small text-fg-2">{op.summary}</p>
                    {fields.length > 0 && (
                      <ul className="mt-3 space-y-1 pl-14">
                        {fields.map((f) => (
                          <li
                            key={`${f.where}-${f.name}`}
                            className="font-mono text-label text-fg-3"
                          >
                            <span className="text-fg-2">{f.name}</span>
                            {f.required ? "" : "?"} · {f.where} · {typeOf(f.s)}
                            {f.s.default !== undefined ? ` = ${JSON.stringify(f.s.default)}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
