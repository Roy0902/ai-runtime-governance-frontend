import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        green: {
          50: { value: '#edf5f0' },
          100: { value: '#d8e9de' },
          200: { value: '#b8d7c6' },
          300: { value: '#8ebda3' },
          400: { value: '#5d9f7f' },
          500: { value: '#327e62' },
          600: { value: '#146b59' },
          700: { value: '#0f5145' },
          800: { value: '#0a3b33' },
          900: { value: '#062b25' },
          950: { value: '#031b18' },
        },
        governance: {
          canvas: { value: '#f1f4f1' },
          surface: { value: '#ffffff' },
          ink: { value: '#172b34' },
          muted: { value: '#4b5e64' },
          placeholder: { value: '#586b71' },
          line: { value: '#d9e2df' },
          controlLine: { value: '#7e928c' },
          disabledSurface: { value: '#e4ebe8' },
          disabledInk: { value: '#3f5359' },
          disabledLine: { value: '#b7c6c1' },
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
    'h1, h2, h3, h4, h5, h6': {
      color: '{colors.governance.ink}',
      fontFamily: '{fonts.heading}',
    },
    a: {
      color: '{colors.governance.primary}',
      textDecoration: 'none',
    },
    'a:hover': {
      textDecoration: 'underline',
    },
    '::placeholder': {
      color: '{colors.governance.placeholder} !important',
      opacity: '1 !important',
    },
    'input:not(:focus), textarea:not(:focus), select:not(:focus)': {
      borderColor: '{colors.governance.controlLine} !important',
    },
    'input:disabled, textarea:disabled, select:disabled': {
      opacity: '1 !important',
      color: '{colors.governance.muted} !important',
      backgroundColor: '{colors.governance.disabledSurface} !important',
      borderColor: '{colors.governance.disabledLine} !important',
      cursor: 'not-allowed',
    },
    'button:disabled': {
      opacity: '1 !important',
      color: '{colors.governance.disabledInk} !important',
      backgroundColor: '{colors.governance.disabledSurface} !important',
      borderColor: '{colors.governance.disabledLine} !important',
      boxShadow: 'none !important',
      cursor: 'not-allowed',
    },
    '*, *::before, *::after': {
      boxSizing: 'border-box',
    },
  },
});

export const system = createSystem(defaultConfig, config);