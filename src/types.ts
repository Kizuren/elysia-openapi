import type { TSchema } from 'elysia'
import type { OpenAPIV3 } from 'openapi-types'
import type { ApiReferenceConfiguration } from '@scalar/types'
import type { SwaggerUIOptions } from './swagger/types'

export type OpenAPIProvider = 'scalar' | 'swagger-ui' | null

type MaybeArray<T> = T | T[]

export interface OpenAPIDocumentationConfig<Path extends string = string> {
	/**
	 * Label shown in Scalar's document selector.
	 */
	name?: string

	/**
	 * The endpoint to expose OpenAPI JSON specification for this document
	 *
	 * @default '/${path}/json'
	 */
	specPath?: string

	/**
	 * OpenAPI config override for this document.
	 */
	documentation?: Omit<
		Partial<OpenAPIV3.Document>,
		| 'x-express-openapi-additional-middleware'
		| 'x-express-openapi-validation-strict'
	>

	/**
	 * Per-document exclusion rules.
	 */
	exclude?: ElysiaOpenAPIConfig['exclude']

	/**
	 * Per-document additional references.
	 */
	references?: AdditionalReferences

	/**
	 * Per-document schema mapper overrides.
	 */
	mapJsonSchema?: MapJsonSchema

	/**
	 * @deprecated Documentation-specific UI path is no longer used.
	 */
	path?: Path

	/**
	 * @deprecated Documentation-specific provider is no longer used.
	 */
	provider?: OpenAPIProvider

	/**
	 * @deprecated Documentation-specific scalar options are no longer used.
	 */
	scalar?: Partial<ApiReferenceConfiguration> & {
		version?: string
		cdn?: string
	}

	/**
	 * @deprecated Documentation-specific swagger options are no longer used.
	 */
	swagger?: Omit<
		Partial<SwaggerUIOptions>,
		| 'dom_id'
		| 'dom_node'
		| 'spec'
		| 'url'
		| 'urls'
		| 'layout'
		| 'pluginsOptions'
		| 'plugins'
		| 'presets'
		| 'onComplete'
		| 'requestInterceptor'
		| 'responseInterceptor'
		| 'modelPropertyMacro'
		| 'parameterMacro'
	> & {
		theme?:
			| string
			| {
					light: string
					dark: string
			  }
		version?: string
		autoDarkMode?: boolean
		cdn?: string
	}

	/**
	 * @deprecated Documentation-specific embedSpec is no longer used.
	 */
	embedSpec?: boolean
}

export type MapJsonSchema = { [vendor: string]: Function } & {
	[vendor in  // schema['~standard'].vendor
		| 'zod'
		| 'effect'
		| 'valibot'
		| 'arktype'
		| 'typemap'
		| 'yup'
		| 'joi']?: Function
}

export type AdditionalReference = {
	[path in string]: {
		[method in string]: {
			params: TSchema
			query: TSchema
			headers: TSchema
			body: TSchema
			response: { [status in number]: TSchema }
		}
	}
}

export type AdditionalReferences = MaybeArray<
	AdditionalReference | undefined | (() => AdditionalReference | undefined)
>

export interface ElysiaOpenAPIConfig<
	Enabled extends boolean = true,
	Path extends string = '/swagger'
> {
	/**
	 * @default true
	 */
	enabled?: Enabled

	/**
	 * OpenAPI config
	 *
	 * @see https://spec.openapis.org/oas/v3.0.3.html
	 */
	documentation?: Omit<
		Partial<OpenAPIV3.Document>,
		| 'x-express-openapi-additional-middleware'
		| 'x-express-openapi-validation-strict'
	>

	exclude?: {
		/**
		 * Exclude methods from OpenAPI
		 */
		methods?: string[]

		/**
		 * Paths to exclude from OpenAPI endpoint
		 *
		 * @default []
		 */
		paths?: string | RegExp | (string | RegExp)[]

		/**
		 * Determine if OpenAPI should exclude static files.
		 *
		 * @default true
		 */
		staticFile?: boolean

		/**
		 * Exclude tags from OpenAPI
		 */
		tags?: string[]
	}

	/**
	 * The endpoint to expose OpenAPI Documentation
	 *
	 * @default '/openapi'
	 */
	path?: Path

	/**
	 * Configure multiple OpenAPI documents for a single documentation UI.
	 *
	 * For Scalar provider, multiple documents are shown in the source selector dropdown.
	 */
	documentations?: MaybeArray<OpenAPIDocumentationConfig>

	/**
	 * Choose your provider, Scalar or Swagger UI
	 *
	 * @default 'scalar'
	 * @see https://github.com/scalar/scalar
	 * @see https://github.com/swagger-api/swagger-ui
	 */
	provider?: OpenAPIDocumentationConfig['provider']

	/**
	 * Additional reference for each endpoint
	 */
	references?: AdditionalReferences

	/**
	 * Embed OpenAPI schema to provider body if possible
	 *
	 * This is highly discouraged, unless you really have to inline OpenAPI schema
	 *
	 * @default false
	 */
	embedSpec?: OpenAPIDocumentationConfig['embedSpec']

	/**
	 * Mapping function from Standard schema to OpenAPI schema
	 *
	 * @example
	 * ```ts
	 * import { openapi } from '@elysiajs/openapi'
	 * import { toJsonSchema } from '@valibot/to-json-schema'
	 *
	 * openapi({
	 * 	mapJsonSchema: {
	 * 	  valibot: toJsonSchema
	 *   }
	 * })
	 */
	mapJsonSchema?: MapJsonSchema

	/**
	 * Scalar configuration to customize scalar
	 *'
	 * @see https://github.com/scalar/scalar/blob/main/documentation/configuration.md
	 */
	scalar?: OpenAPIDocumentationConfig['scalar']
	/**
	 * The endpoint to expose OpenAPI JSON specification
	 *
	 * @default '/${path}/json'
	 */
	specPath?: string

	/**
	 * Options to send to SwaggerUIBundle
	 * Currently, options that are defined as functions such as requestInterceptor
	 * and onComplete are not supported.
	 */
	swagger?: OpenAPIDocumentationConfig['swagger']
}
