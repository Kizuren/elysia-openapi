import { Elysia, t } from 'elysia'
import { openapi, type ElysiaWithOpenAPI } from '../src'

const plugin = openapi({
	exclude: {
		paths: ['/internal'],
		tags: ['admin']
	}
}) as ElysiaWithOpenAPI

const app = new Elysia()
	.use(plugin)
	.get('/', () => 'Public endpoint')
	.get('/users', () => 'Users list', {
		detail: { tags: ['users'] }
	})
	.get('/admin', () => 'Admin panel', {
		detail: { tags: ['admin'] }
	})
	.get('/internal', () => 'Internal endpoint')
	.get('/health', () => 'OK')
	.listen(8080)

console.log('Server started at http://localhost:8080/openapi')

setTimeout(() => {
    plugin.openapi.removeExcludedPaths('/internal')
	console.log('\nRemoved /internal from exclusion')
	console.log('Current exclusion:', plugin.openapi.getExclusion())
}, 5000)

setTimeout(() => {
    plugin.openapi.addExcludedPaths('/health')
	console.log('\nAdded /health to exclusion')
	console.log('Current exclusion:', plugin.openapi.getExclusion())
}, 10000)

setTimeout(() => {
    plugin.openapi.removeExcludedTags('admin')
	console.log('\nRemoved admin tag from exclusion')
	console.log('Current exclusion:', plugin.openapi.getExclusion())
}, 15000)

setTimeout(() => {
    plugin.openapi.setExclusion({})
	console.log('\nResetted all exclusions')
	console.log('Current exclusion:', plugin.openapi.getExclusion())
}, 20000)
