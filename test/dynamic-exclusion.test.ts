import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { openapi, type ElysiaWithOpenAPI } from '../src'

describe('Dynamic Exclusion', () => {
	it('should allow adding excluded paths at runtime', async () => {
		const plugin = openapi() as ElysiaWithOpenAPI
		const app = new Elysia().use(plugin).get('/public', () => 'public').get('/private', () => 'private')

		// Initially, both endpoints should be visible
		const res1 = await app.handle(new Request('http://localhost/openapi/json'))
		const spec1 = await res1.json()
		expect(spec1.paths['/public']).toBeDefined()
		expect(spec1.paths['/private']).toBeDefined()

		// Add /private to exclusion
		plugin.openapi.addExcludedPaths('/private')

		// Now /private should be excluded
		const res2 = await app.handle(new Request('http://localhost/openapi/json'))
		const spec2 = await res2.json()
		expect(spec2.paths['/public']).toBeDefined()
		expect(spec2.paths['/private']).toBeUndefined()
	})

	it('should allow removing excluded paths at runtime', async () => {
		const plugin = openapi({
			exclude: {
				paths: ['/private']
			}
		}) as ElysiaWithOpenAPI
		const app = new Elysia().use(plugin).get('/public', () => 'public').get('/private', () => 'private')

		// Initially, /private should be excluded
		const res1 = await app.handle(new Request('http://localhost/openapi/json'))
		const spec1 = await res1.json()
		expect(spec1.paths['/public']).toBeDefined()
		expect(spec1.paths['/private']).toBeUndefined()

		// Remove /private from exclusion
		plugin.openapi.removeExcludedPaths('/private')

		// Now /private should be visible
		const res2 = await app.handle(new Request('http://localhost/openapi/json'))
		const spec2 = await res2.json()
		expect(spec2.paths['/public']).toBeDefined()
		expect(spec2.paths['/private']).toBeDefined()
	})

	it('should allow adding excluded tags at runtime', async () => {
		const plugin = openapi() as ElysiaWithOpenAPI
		const app = new Elysia()
			.use(plugin)
			.get('/admin', () => 'admin', {
				detail: { tags: ['admin'] }
			})
			.get('/user', () => 'user', {
				detail: { tags: ['user'] }
			})

		// Initially, both endpoints should be visible
		const res1 = await app.handle(new Request('http://localhost/openapi/json'))
		const spec1 = await res1.json()
		expect(spec1.paths['/admin']).toBeDefined()
		expect(spec1.paths['/user']).toBeDefined()

		// Add 'admin' tag to exclusion
		plugin.openapi.addExcludedTags('admin')

		// Routes tagged with 'admin' are now excluded
		const res2 = await app.handle(new Request('http://localhost/openapi/json'))
		const spec2 = await res2.json()
		expect(spec2.paths['/admin']).toBeUndefined()
		expect(spec2.paths['/user']).toBeDefined()
	})

	it('should allow setting entire exclusion config', async () => {
		const plugin = openapi() as ElysiaWithOpenAPI
		const app = new Elysia()
			.use(plugin)
			.get('/public', () => 'public')
			.get('/private', () => 'private')

		// Set exclusion config
		plugin.openapi.setExclusion({
			paths: ['/private']
		})

		const res = await app.handle(new Request('http://localhost/openapi/json'))
		const spec = await res.json()
		expect(spec.paths['/public']).toBeDefined()
		expect(spec.paths['/private']).toBeUndefined()

		// Reset exclusion
		plugin.openapi.setExclusion({})

		const res2 = await app.handle(new Request('http://localhost/openapi/json'))
		const spec2 = await res2.json()
		expect(spec2.paths['/public']).toBeDefined()
		expect(spec2.paths['/private']).toBeDefined()
	})

	it('should return current exclusion config', () => {
		const plugin = openapi({
			exclude: {
				paths: ['/test'],
				tags: ['admin']
			}
		}) as ElysiaWithOpenAPI

		const config = plugin.openapi.getExclusion()
		expect(config).toEqual({
			paths: ['/test'],
			tags: ['admin']
		})
	})

	it('should invalidate cache when exclusions change', async () => {
		const plugin = openapi() as ElysiaWithOpenAPI
		const app = new Elysia().use(plugin).get('/test', () => 'test')

		// Get initial schema
		const res1 = await app.handle(new Request('http://localhost/openapi/json'))
		const spec1 = await res1.json()
		expect(spec1.paths['/test']).toBeDefined()

		// Modify exclusion
		plugin.openapi.addExcludedPaths('/test')

		// Schema should be regenerated
		const res2 = await app.handle(new Request('http://localhost/openapi/json'))
		const spec2 = await res2.json()
		expect(spec2.paths['/test']).toBeUndefined()
	})
})
