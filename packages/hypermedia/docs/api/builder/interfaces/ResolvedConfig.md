[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [builder](../README.md) / ResolvedConfig

# Interface: ResolvedConfig

## Extends

- `HydraConfig`

## Properties

### build

> **build**: `object`

configuration specific to the production docs generator build command

#### outputDir

> **outputDir**: `string`

Absolute path to the output directory for generated files. Use path.resolve(\_\_dirname, '...') in your config.

#### Inherited from

`HydraConfig.build`

---

### classes

> **classes**: [`ClassDef`](../../index/namespaces/HydraDoc/interfaces/ClassDef.md)\<`never`\>[]

Hydra class definitions to document

#### Inherited from

`HydraConfig.classes`

---

### docs

> **docs**: `object`

configuration specific to the stable documentation generator command

#### outputDir

> **outputDir**: `string`

Absolute path to the output directory for generated files. Use path.resolve(\_\_dirname, '...') in your config.

#### Inherited from

`HydraConfig.docs`

---

### environments?

> `optional` **environments**: `Record`\<`string`, `EnvironmentConfig`\>

Named environment map for URN resolution.
Each key is an environment name, values contain the base URLs (e.g. docs at 'http://localhost:3002/api/meta').
The `dev` environment is used by default for OpenAPI validation.

#### Inherited from

`HydraConfig.environments`

---

### envName

> **envName**: `string`

---

### extraContext?

> `optional` **extraContext**: `Record`\<`string`, `unknown`\>

Extra JSON-LD context terms

#### Inherited from

`HydraConfig.extraContext`

---

### openapi?

> `optional` **openapi**: `OpenApiConfig`

OpenAPI generation config. Omit to skip OpenAPI generation.

#### Inherited from

`HydraConfig.openapi`

---

### prefixes

> **prefixes**: `string`[]

Domain CURIE prefix names used in classes/mappings

#### Inherited from

`HydraConfig.prefixes`

---

### resolved

> **resolved**: `object`

Resolved absolute paths to the output directories

#### build

> **build**: `object`

##### build.outputDir

> **outputDir**: `string`

#### docs

> **docs**: `object`

##### docs.outputDir

> **outputDir**: `string`

---

### schema?

> `optional` **schema**: `SchemaUrnResolver`

Schema URN resolution. Required when classes define schemas.
Controls how schema identifiers are detected and mapped to dereferenceable URLs.

#### Inherited from

`HydraConfig.schema`

---

### strictPrefixes?

> `optional` **strictPrefixes**: `boolean`

Throw on unknown prefix (default: true)

#### Inherited from

`HydraConfig.strictPrefixes`
