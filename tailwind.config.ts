import type { Config } from 'tailwindcss';

/**
 * Rezzerv tasarım sistemi.
 * Mavi–beyaz omurga; yeşil yalnızca onay/başarı, kırmızı yalnızca hata ve
 * iptal anlamına gelir. Renk hiçbir yerde dekorasyon değildir.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EFF5FF',
          100: '#DCE9FF',
          200: '#BDD5FF',
          300: '#94B9FF',
          400: '#5C93FF',
          500: '#176BFF',
          600: '#0E52D9',
          700: '#0C41AE',
          800: '#0E3684',
          900: '#0B2A63',
        },
        navy: {
          DEFAULT: '#0B1F3A',
          soft: '#13294B',
          muted: '#41536B',
        },
        canvas: '#F5F8FC',
        surface: '#FFFFFF',
        sunken: '#EEF3FA',
        line: {
          DEFAULT: '#E4EBF4',
          strong: '#CFDBEA',
        },
        ink: {
          DEFAULT: '#0B1F3A',
          2: '#41536B',
          // İkincil metin her yerde 11,5–13 px kullanılır; WCAG AA bu boyutta
          // 4.5:1 ister. Eski #76869C beyazda 3,7:1, canvas üzerinde 3,5:1
          // kalıyordu — yani kart açıklamaları sayfanın en zor okunan yazısıydı.
          3: '#5D6E87', // beyazda 5,2:1 · canvas üzerinde 4,9:1
        },
        success: {
          DEFAULT: '#12855A',
          soft: '#E6F6EE',
          line: '#B7E4CE',
        },
        danger: {
          DEFAULT: '#C62B36',
          soft: '#FDECEE',
          line: '#F5C2C7',
        },
        warn: {
          DEFAULT: '#9A6412',
          soft: '#FDF4E3',
          line: '#EBD4A6',
        },
      },
      borderRadius: {
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
        '3xl': '24px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,31,58,.05), 0 8px 24px -12px rgba(11,31,58,.14)',
        lift: '0 2px 6px rgba(11,31,58,.06), 0 18px 40px -18px rgba(11,31,58,.22)',
        pop: '0 12px 40px -8px rgba(11,31,58,.24)',
        inset: 'inset 0 1px 0 rgba(255,255,255,.6)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        num: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'sheet-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out',
        'slide-up': 'slide-up .22s cubic-bezier(.2,.8,.2,1)',
        'sheet-in': 'sheet-in .26s cubic-bezier(.2,.8,.2,1)',
        'sheet-in-right': 'sheet-in-right .26s cubic-bezier(.2,.8,.2,1)',
        'scale-in': 'scale-in .16s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
