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
	documentations,
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

	const toAbsolutePath = (value: string) =>
		value.startsWith('/') ? value : `/${value}`

	const toSlug = (value: string) =>
		value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')

	const normalizedDocumentations = (() => {
		const list = Array.isArray(documentations)
			? documentations
			: documentations
				? [documentations]
				: [
						{
							path,
							provider,
							specPath,
							swagger,
							scalar,
							embedSpec
						}
					]

		return list.map((documentationConfig, index) => {
			const documentationSpecPath = documentationConfig.specPath ?? `${path}/json`
			const documentationInfo = documentationConfig.documentation?.info
			const defaultName =
				documentationInfo?.title || `Document ${index + 1}`

			return {
				name: documentationConfig.name ?? defaultName,
				specPath: documentationSpecPath,
				absoluteSpecPath: toAbsolutePath(documentationSpecPath),
				documentation: documentationConfig.documentation,
				exclude: documentationConfig.exclude,
				references: documentationConfig.references,
				mapJsonSchema: documentationConfig.mapJsonSchema
			}
		})
	})()

	let totalRoutes = 0
	const cachedSchemas = new Map<string, OpenAPIV3.Document>()
	
	// Mutable exclude configuration
	let currentExclude: ElysiaOpenAPIConfig['exclude'] = exclude ? { ...exclude } : undefined
	
	const invalidateCache = () => {
		cachedSchemas.clear()
		totalRoutes = 0
	}

	const mergeExclude = (
		globalExclude: ElysiaOpenAPIConfig['exclude'],
		localExclude: ElysiaOpenAPIConfig['exclude']
	): ElysiaOpenAPIConfig['exclude'] => {
		if (!globalExclude && !localExclude) return undefined

		const toArray = <T>(value?: T | T[]) =>
			value === undefined ? [] : Array.isArray(value) ? value : [value]

		const globalPaths = toArray(globalExclude?.paths)
		const localPaths = toArray(localExclude?.paths)

		return {
			methods: [...(globalExclude?.methods ?? []), ...(localExclude?.methods ?? [])],
			tags: [...(globalExclude?.tags ?? []), ...(localExclude?.tags ?? [])],
			paths: [...globalPaths, ...localPaths],
			staticFile:
				localExclude?.staticFile === undefined
					? globalExclude?.staticFile
					: localExclude.staticFile
		}
	}

	const toFullSchema = ({
		paths,
		components: { schemas }
	}: ReturnType<typeof toOpenAPISchema>,
	resolvedDocumentation: Partial<OpenAPIV3.Document>,
	resolvedExclude: ElysiaOpenAPIConfig['exclude']
	): OpenAPIV3.Document => {
		const safeDocumentation = resolvedDocumentation ?? {}

		return {
			openapi: '3.0.3',
			...safeDocumentation,
			tags: !resolvedExclude?.tags
				? safeDocumentation.tags
				: safeDocumentation.tags?.filter(
						(tag) => !resolvedExclude.tags?.includes(tag.name)
					),
			info: {
				title: 'Elysia Documentation',
				description: 'Development documentation',
				version: '0.0.0',
				...safeDocumentation.info
			},
			paths: {
				...paths,
				...safeDocumentation.paths
			},
			components: {
				...safeDocumentation.components,
				schemas: {
					...schemas,
					...(safeDocumentation.components?.schemas as any)
				}
			}
		}
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

	const renderDocumentationPage = (
		parentApp: Elysia,
		firstDocumentation: (typeof normalizedDocumentations)[number]
	) => {
		const scalarBaseOptions: any = {
			version: 'latest',
			cdn: `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${scalar?.version ?? 'latest'}/dist/browser/standalone.min.js`,
			...(scalar as ApiReferenceConfiguration),
			_integration: 'elysiajs'
		}
		let scalarOptions: any = scalarBaseOptions

		if (normalizedDocumentations.length > 1) {
			// Use array-of-configs format for better compatibility across Scalar versions.
			scalarOptions.sources = normalizedDocumentations.map(
				(documentationConfig, index) => ({
					
					title: documentationConfig.name,
					slug: toSlug(documentationConfig.name),
					url: documentationConfig.absoluteSpecPath,
					default: index === 0
				})
			)
		} else {
			scalarOptions.url = firstDocumentation.absoluteSpecPath
		}

		return new Response(
			provider === 'swagger-ui'
				? SwaggerUIRender(info, {
						url: firstDocumentation.absoluteSpecPath,
						dom_id: '#swagger-ui',
						version: 'latest',
						autoDarkMode: true,
						...swagger
				  })
				: ScalarRender(
						info,
						scalarOptions,
						embedSpec && normalizedDocumentations.length === 1
							? JSON.stringify(
									totalRoutes === parentApp.routes.length
										? cachedSchemas.get(firstDocumentation.specPath)
										: toFullSchema(
												toOpenAPISchema(
													parentApp,
													currentExclude,
													references,
													mapJsonSchema
												),
												documentation,
												currentExclude
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
	}

	let plugin: any = app.use((parentApp) => {
		if (provider === null) return parentApp

		const firstDocumentation = normalizedDocumentations[0]
		const page = () => renderDocumentationPage(parentApp, firstDocumentation)

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

	const uniqueSpecPaths = [...new Set(normalizedDocumentations.map((x) => x.specPath))]

	for (const resolvedSpecPath of uniqueSpecPaths) {
		const documentationConfig = normalizedDocumentations.find(
			(config) => config.specPath === resolvedSpecPath
		)!

		plugin = plugin.get(
			resolvedSpecPath,
			function openAPISchema(): OpenAPIV3.Document {
				if (totalRoutes === app.routes.length) {
					const cachedSchema = cachedSchemas.get(resolvedSpecPath)
					if (cachedSchema) return cachedSchema
				}

				totalRoutes = app.routes.length

				const resolvedExclude = mergeExclude(
					currentExclude,
					documentationConfig.exclude
				)
				const resolvedDocumentation: Partial<OpenAPIV3.Document> = {
					...documentation,
					...documentationConfig.documentation,
					info: {
						...documentation.info,
						...documentationConfig.documentation?.info
					} as any
				}
				const resolvedReferences =
					documentationConfig.references ?? references
				const resolvedMapJsonSchema =
					documentationConfig.mapJsonSchema ?? mapJsonSchema

				const schema = toFullSchema(
					toOpenAPISchema(
						app,
						resolvedExclude,
						resolvedReferences,
						resolvedMapJsonSchema
					),
					resolvedDocumentation as Partial<OpenAPIV3.Document>,
					resolvedExclude
				)

				cachedSchemas.set(resolvedSpecPath, schema)

				return schema
			},
			{
				error({ error }: { error: unknown }) {
					console.log('[@elysiajs/openapi] error at specPath')
					console.warn(error)
				},
				detail: {
					hide: true
				}
			}
		)
	}

	return plugin as ElysiaWithOpenAPI
}

export { fromTypes } from './gen'
export { toOpenAPISchema, withHeaders } from './openapi'
export type { ElysiaOpenAPIConfig }

export default openapi
