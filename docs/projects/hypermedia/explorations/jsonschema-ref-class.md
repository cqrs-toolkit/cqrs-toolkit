# `svc:jsonSchema` as a `svc:JsonSchemaRef` object

## Status

Open, deferred. Captured 2026-05-23 while designing the `@cqrs-toolkit/hypermedia-client` JSON-Schema → TypeScript codegen pipeline.
The client work proceeds against the current string-valued `svc:jsonSchema` and a URL-path-derived URN; this exploration captures the apidoc-side reshape to return to once that lands.

## Driver

`@cqrs-toolkit/hypermedia-client` needs a deployment-invariant identity for each JSON Schema in order to:

1. Name generated TypeScript types deterministically via a user-supplied `(urn) => name` resolver.
2. Recognise that a schema pulled from prod and the same schema pulled from staging are the same entity — every URL inside a deployed schema (`$id`, every `$ref`) is rewritten per-deployment by the hypermedia server's build step, so URLs cannot serve as cross-deployment identity.

The URN already exists (`urn:schema:<ns>.<Name>:<version>`); it is the `$id` of source schemas before the deploy-build URL-rewrite.
The apidoc currently advertises only the rewritten URL via `svc:jsonSchema: string`, dropping the URN entirely.

## Inputs and outputs

The producer-facing code surface (how a server consumer declares commands and schemas) is unchanged.
What changes is the generated apidoc JSON-LD and the corresponding TypeScript types in [`packages/hypermedia/src/HydraApiDocumentation.ts`](../../../../packages/hypermedia/src/HydraApiDocumentation.ts).

## Proposed shape

`svc:jsonSchema` values move from a coerced IRI string to an object carrying both forms:

```jsonc
"svc:jsonSchema": {
  "@id": "https://example.com/.../1.0.0.json",
  "svc:urn": "urn:schema:chat.Message:1.0.0"
}
```

The stable committed apidoc (pre-deploy) has the same URN value in both `@id` and `svc:urn`.
The deploy-build step transforms `@id` into the real deployment URL and leaves `svc:urn` alone.
Same treatment applies to `svc:responseSchema[].svc:jsonSchema`.

### `@context` additions

A new prefix:

```
"rdfs": "http://www.w3.org/2000/01/rdf-schema#"
```

The current `'svc:jsonSchema': { '@type': '@id' }` coercion is removed — the value is now an object, not a coerced IRI.

### Apidoc definitions

Add a property definition for `svc:jsonSchema` and a class definition for `svc:JsonSchemaRef`, somewhere appropriate for vocabulary definitions (placement is part of the open self-description question below):

```jsonc
{
  "@id": "svc:jsonSchema",
  "@type": "rdf:Property",
  "rdfs:range": { "@id": "svc:JsonSchemaRef" }
},
{
  "@id": "svc:JsonSchemaRef",
  "@type": "hydra:Class",
  "hydra:supportedProperty": [
    {
      "@type": "hydra:SupportedProperty",
      "hydra:property": {
        "@id": "svc:urn",
        "@type": "rdf:Property",
        "rdfs:range": { "@id": "xsd:string" }
      },
      "hydra:required": true
    }
  ]
}
```

If `xsd:string` is used, the `xsd` prefix is also added to `@context`.

## Code surfaces this touches

- [`packages/hypermedia/src/HydraApiDocumentation.ts`](../../../../packages/hypermedia/src/HydraApiDocumentation.ts) — `CommandCapability['svc:jsonSchema']` and `ContentTypeSchema['svc:jsonSchema']` change from `string` to a `JsonSchemaRef` interface (`{ '@id': string; 'svc:urn': string }`).
- [`packages/hypermedia/src/builder/HydraBuilder.ts`](../../../../packages/hypermedia/src/builder/HydraBuilder.ts) — the `@context` entries, the supported-class list, and the three `svc:jsonSchema` emit sites.
- Per-deploy URL-rewrite tooling (the build step that bakes deployment URLs into `$id` and `svc:jsonSchema`) — adjusts to rewrite the object's `@id` rather than the bare string, and to leave `svc:urn` untouched.

## Broader gap surfaced

`svc:JsonSchemaRef` is a meta-vocabulary class — part of how the apidoc describes itself, not part of the consumer's domain.
The apidoc today declares classes in `hydra:supportedClass` exclusively for consumer-defined types; it does not self-describe its own meta types (`svc:JsonSchemaRef`, `svc:CommandCapability`, `svc:Representation`, etc.).

Where these definitions belong — interleaved into `hydra:supportedClass`, hoisted into a separate sibling array, or split out as a referenced vocabulary document — is the larger question this change opens.
Out of scope here; revisit when more meta-vocabulary additions accumulate.

## Why not decide now

Deferred until the client-side codegen lands and exercises the URL-path-derived URN path, which will surface any remaining sharp edges in how the URN is consumed (resolver signature, collision handling, enum cross-ref naming).
The shape proposed here is forward-compatible with that work; the client can later switch from URL-path derivation to reading `svc:urn` from the apidoc with no producer-facing changes.
