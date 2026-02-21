import { Elysia } from 'elysia'

import { SwaggerUIRender } from './swagger'
import { ScalarRender } from './scalar'

import { toOpenAPISchema } from './openapi'

import type { OpenAPIV3 } from 'openapi-types'
import type { ApiReferenceConfiguration } from '@scalar/types'
import type { ElysiaOpenAPIConfig } from './types'

export interface OpenAPIMethods {
	/**
	 * Set exclusion configuration
	 */
	setExclusion(newExclude?: ElysiaOpenAPIConfig['exclude']): OpenAPIMethods
	/**
	 * Add paths to exclude from OpenAPI documentation
	 */
	addExcludedPaths(...paths: (string | RegExp)[]): OpenAPIMethods
	/**
	 * Remove paths from exclusion list
	 */
	removeExcludedPaths(...paths: (string | RegExp)[]): OpenAPIMethods
	/**
	 * Add tags to exclude from OpenAPI documentation
	 */
	addExcludedTags(...tags: string[]): OpenAPIMethods
	/**
	 * Remove tags from exclusion list
	 */
	removeExcludedTags(...tags: string[]): OpenAPIMethods
	/**
	 * Add HTTP methods to exclude from OpenAPI documentation
	 */
	addExcludedMethods(...methods: string[]): OpenAPIMethods
	/**
	 * Remove HTTP methods from exclusion list
	 */
	removeExcludedMethods(...methods: string[]): OpenAPIMethods
	/**
	 * Get current exclusion configuration
	 */
	getExclusion(): ElysiaOpenAPIConfig['exclude'] | undefined
}

// This is needed, so typescript can work
export type ElysiaWithOpenAPI<T extends Elysia = Elysia> = T & {
	openapi: OpenAPIMethods
}

function isCloudflareWorker() {
	try {
		// Check for the presence of caches.default, which is a global in Workers
		if (
			// @ts-ignore
			typeof caches !== 'undefined' &&
			// @ts-ignore
			typeof caches.default !== 'undefined'
		)
			return true

		// @ts-ignore
		if (typeof WebSocketPair !== 'undefined') {
			return true
		}
	} catch (e) {
		// If accessing these globals throws an error, it's likely not a Worker
		return false
	}

	return false
}

/**
 * Plugin for [elysia](https://github.com/elysiajs/elysia) that auto-generate OpenAPI documentation page.
 *
 * @see https://github.com/elysiajs/elysia-swagger
 */
export const openapi = <
	const Enabled extends boolean = true,
	const Path extends string = '/openapi'
>({
	enabled = true as Enabled,
	path = '/openapi' as Path,
	provider = 'scalar',
	specPath = `${path}/json`,
	documentation = {},
	exclude,
	swagger,
	scalar,
	references,
	mapJsonSchema,
	embedSpec
}: ElysiaOpenAPIConfig<Enabled, Path> = {}) => {
	if (!enabled) return new Elysia({ name: '@elysiajs/openapi' })

	const info = {
		title: 'Elysia Documentation',
		description: 'Development documentation',
		version: '0.0.0',
		...documentation.info
	}

	const absolutePath = specPath.startsWith('/') ? specPath : `/${specPath}`

	let totalRoutes = 0
	let cachedSchema: OpenAPIV3.Document | undefined
	
	// Mutable exclude configuration
	let currentExclude: ElysiaOpenAPIConfig['exclude'] = exclude ? { ...exclude } : undefined
	
	const invalidateCache = () => {
		cachedSchema = undefined
		totalRoutes = 0
	}

	const toFullSchema = ({
		paths,
		components: { schemas }
	}: ReturnType<typeof toOpenAPISchema>): OpenAPIV3.Document => {
		return (cachedSchema = {
			openapi: '3.0.3',
			...documentation,
			tags: !currentExclude?.tags
				? documentation.tags
				: documentation.tags?.filter(
						(tag) => !currentExclude!.tags?.includes(tag.name)
					),
			info: {
				title: 'Elysia Documentation',
				description: 'Development documentation',
				version: '0.0.0',
				...documentation.info
			},
			paths: {
				...paths,
				...documentation.paths
			},
			components: {
				...documentation.components,
				schemas: {
					...schemas,
					...(documentation.components?.schemas as any)
				}
			}
		})
	}

	const openapiMethods = {
		/**
		 * Set exclusion configuration
		 */
		setExclusion(newExclude: ElysiaOpenAPIConfig['exclude']) {
			currentExclude = newExclude ? { ...newExclude } : undefined
			invalidateCache()
			return openapiMethods
		},
		/**
		 * Add paths to exclude
		 */
		addExcludedPaths(...paths: (string | RegExp)[]) {
			if (!currentExclude) currentExclude = {}
			const currentPaths = Array.isArray(currentExclude.paths)
				? currentExclude.paths
				: currentExclude.paths
					? [currentExclude.paths]
					: []
			currentExclude.paths = [...currentPaths, ...paths]
			invalidateCache()
			return openapiMethods
		},
		/**
		 * Remove paths from exclude list
		 */
		removeExcludedPaths(...paths: (string | RegExp)[]) {
			if (!currentExclude?.paths) return openapiMethods
			const currentPaths = Array.isArray(currentExclude.paths)
				? currentExclude.paths
				: [currentExclude.paths]
			currentExclude.paths = currentPaths.filter(
				(p) => !paths.some((path) => 
					p instanceof RegExp && path instanceof RegExp
						? p.source === path.source && p.flags === path.flags
						: p === path
				)
			)
			invalidateCache()
			return openapiMethods
		},
		/**
		 * Add tags to exclude
		 */
		addExcludedTags(...tags: string[]) {
			if (!currentExclude) currentExclude = {}
			currentExclude.tags = [...(currentExclude.tags ?? []), ...tags]
			invalidateCache()
			return openapiMethods
		},
		/**
		 * Remove tags from exclude list
		 */
		removeExcludedTags(...tags: string[]) {
			if (!currentExclude?.tags) return openapiMethods
			currentExclude.tags = currentExclude.tags.filter(
				(t) => !tags.includes(t)
			)
			invalidateCache()
			return openapiMethods
		},
		/**
		 * Add methods to exclude
		 */
		addExcludedMethods(...methods: string[]) {
			if (!currentExclude) currentExclude = {}
			currentExclude.methods = [...(currentExclude.methods ?? []), ...methods]
			invalidateCache()
			return openapiMethods
		},
		/**
		 * Remove methods from exclude list
		 */
		removeExcludedMethods(...methods: string[]) {
			if (!currentExclude?.methods) return openapiMethods
			currentExclude.methods = currentExclude.methods.filter(
				(m) => !methods.includes(m)
			)
			invalidateCache()
			return openapiMethods
		},
		/**
		 * Get current exclusion configuration
		 */
		getExclusion() {
			return currentExclude ? { ...currentExclude } : undefined
		}
	}

	const app = new Elysia({ name: '@elysiajs/openapi' })

	// Attach openapi methods to the plugin instance
	;(app as any).openapi = openapiMethods

	app.use((parentApp) => {
		if (provider === null) return parentApp

		const page = () =>
			new Response(
				provider === 'swagger-ui'
					? SwaggerUIRender(info, {
							url: absolutePath,
							dom_id: '#swagger-ui',
							version: 'latest',
							autoDarkMode: true,
							...swagger
						})
					: ScalarRender(
							info,
							{
								url: absolutePath,
								version: 'latest',
								cdn: `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${scalar?.version ?? 'latest'}/dist/browser/standalone.min.js`,
								...(scalar as ApiReferenceConfiguration),
								_integration: 'elysiajs'
							},
							embedSpec
								? JSON.stringify(
										totalRoutes === parentApp.routes.length
											? cachedSchema
											: toFullSchema(
													toOpenAPISchema(
														parentApp,
														currentExclude,
														references,
														mapJsonSchema
													)
												)
									)
								: undefined
						),
				{
					headers: {
						'content-type': 'text/html; charset=utf8'
					}
				}
			)

		return parentApp.get(
			path,
			embedSpec || isCloudflareWorker() ? page : page(),
			{
				detail: {
					hide: true
				}
			}
		)
	})
		.get(
			specPath,
			function openAPISchema(): OpenAPIV3.Document {
				if (totalRoutes === app.routes.length && cachedSchema)
					return cachedSchema

				totalRoutes = app.routes.length

				return toFullSchema(
					toOpenAPISchema(app, currentExclude, references, mapJsonSchema)
				)
			},
			{
				error({ error }) {
					console.log('[@elysiajs/openapi] error at specPath')
					console.warn(error)
				},
				detail: {
					hide: true
				}
			}
		)

	return app as ElysiaWithOpenAPI
}

export { fromTypes } from './gen'
export { toOpenAPISchema, withHeaders } from './openapi'
export type { ElysiaOpenAPIConfig }

export default openapi
