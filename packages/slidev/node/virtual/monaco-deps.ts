import { resolve } from 'node:path'
import { uniq } from '@antfu/utils'
import type { VirtualModuleTemplate } from './types'

export const templateMonacoRunDeps: VirtualModuleTemplate = {
  id: '/@slidev/monaco-run-deps',
  getContent: async ({ userRoot, data }, pluginCtx) => {
    if (!data.features.monaco)
      return ''
    const deps = uniq(data.features.monaco.deps.concat(data.config.monacoTypesAdditionalPackages))
    const importerPath = resolve(userRoot, './snippets/__importer__.ts')
    let result = ''
    for (let i = 0; i < deps.length; i++) {
      const specifier = deps[i]
      const resolved = await pluginCtx.resolve(specifier, importerPath)
      if (!resolved)
        continue
      result += `import * as vendored${i} from ${JSON.stringify(resolved.id)}\n`
    }
    result += 'export default {\n'
    for (let i = 0; i < deps.length; i++)
      result += `${JSON.stringify(deps[i])}: vendored${i},\n`

    result += '}\n'
    return result
  },
}
