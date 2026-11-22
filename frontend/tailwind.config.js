/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#148F86',
          dark: '#0e6962',
          light: '#20a79d',
          subtle: 'rgba(20, 143, 134, 0.08)',
          active: '#E6F5F3',
          tile: '#D3EFEC',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          page: '#F4F7F6',
          muted: '#F9FAFB',
          nested: '#EEF1F4',
          nestedHover: '#E4E9EE',
        },
        text: {
          primary: '#111827',
          secondary: '#6B7280',
          muted: '#9CA3AF',
          shell: '#1A2E2B',
        },
        status: {
          success: '#10B981',
          warning: '#F7B11B',
          error: '#EF4444',
          urgent: '#F97316',
          info: '#0284C7',
        },
        border: {
          DEFAULT: '#E5E7EB',
          light: '#E9ECEF',
          subtle: '#F3F4F6',
          search: '#D3DFDD',
        }
      },
      borderRadius: {
        control: '10px',
        tile: '14px',
        card: '20px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 6px rgba(0, 0, 0, 0.03)',
        cardHover: '0 4px 10px rgba(0, 0, 0, 0.05)',
        modal: '0 8px 24px rgba(0, 0, 0, 0.08)',
      }
    },
  },
  plugins: [],
}
