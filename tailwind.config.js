/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      maxWidth: {
        'aui-thread': 'var(--aui-thread-max-width)',
      },
      borderRadius: {
        lg: 'var(--aui-radius)',
        md: 'calc(var(--aui-radius) - 2px)',
        sm: 'calc(var(--aui-radius) - 4px)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
}; 