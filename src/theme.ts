import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        governance: {
          canvas: { value: '#f1f4f1' },
          surface: { value: '#ffffff' },
          ink: { value: '#172b34' },
          muted: { value: '#62747a' },
          line: { value: '#d9e2df' },
          primary: { value: '#146b59' },
          primaryHover: { value: '#0f5145' },
          accent: { value: '#bf563e' },
          warning: { value: '#93610e' },
          danger: { value: '#a4352b' },
          success: { value: '#28714e' },
        },
      },
      fonts: {
        heading: { value: '"Space Grotesk Variable", sans-serif' },
        body: { value: '"IBM Plex Sans Variable", sans-serif' },
      },
    },
  },
  globalCss: {
    'html, body, #root': {
      minHeight: '100%',
    },
    body: {
      margin: 0,
      color: '{colors.governance.ink}',
      background: '{colors.governance.canvas}',
      fontFamily: '{fonts.body}',
    },
    '*, *::before, *::after': {
      boxSizing: 'border-box',
    },
  },
});

export const system = createSystem(defaultConfig, config);