// @nuxt/eslint generates .nuxt/eslint.config.mjs during `nuxt prepare`.
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    'vue/multi-word-component-names': 'off',
    'vue/singleline-html-element-content-newline': 'error',
    'vue/max-attributes-per-line': ['error', {
      singleline: { max: 1 },
      multiline: { max: 1 }
    }]
  }
})
