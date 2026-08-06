/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Real "Blush on White" v2 tokens, ported from
        // design-reference/design-tokens.md (source of truth for the
        // current rebrand — see moved-crm/CLAUDE.md step 2).
        // Anchors below are exact hex values from that doc:
        //   50  = brand.blush-tint    (#fbecf0)
        //   100 = brand.blush-chip-border (#f4d6df)
        //   500 = brand.blush         (#E58AA1) — primary CTA / accent
        //   600 = brand.blush-deep    (#C9587E) — small text on white, needs contrast
        //   700 = brand.blush-deep-hover (#b04468) — link hover
        // 200/300/400/800/900 are interpolated between those anchors to
        // keep a full Tailwind scale; treat them as approximate.
        blush: {
          50: '#FBECF0',
          100: '#F4D6DF',
          200: '#EFBDCA',
          300: '#ECB0C0',
          400: '#E89DB0',
          500: '#E58AA1', // brand.blush — primary accent (exact)
          600: '#C9587E', // brand.blush-deep — text/links/active tab (exact)
          700: '#B04468', // brand.blush-deep-hover (exact)
          800: '#8F3654',
          900: '#6F293F',
        },
        // Warm neutral "ink" scale. 900/500/300 map to exact tokens from
        // design-tokens.md; 700 is interpolated between them.
        ink: {
          900: '#1A1714', // ink — headlines / body-primary (exact)
          700: '#6F665E', // icon.secondary (exact)
          500: '#8A827A', // text.secondary — subtitles/body-secondary (exact)
          400: '#A89E96', // text.muted — hints, archived text (exact)
          300: '#C6BDB2', // text.ghost — faintest placeholder tone (exact)
        },
        // Redesign (2026-08): warm-neutral surfaces/borders. Blush is now
        // reserved for interactive intent only (see design_handoff_crm_redesign
        // README) — these replace blush-50/blush-100 as the default
        // card/table/input/page treatment.
        surface: {
          page: '#FAF8F6',
          input: '#FAF8F6',
          warm: '#F4F1ED',
          rowAlt: '#FDFCFB',
          header: '#FCFAF8',
        },
        line: {
          card: '#F1ECE6',
          input: '#F0E8E2',
          divider: '#F5F1ED',
        },
        // Semantic status colours — replace blush-tinted status badges so
        // status carries information at a glance.
        success: {
          DEFAULT: '#5F8D72',
          tint: '#EEF4F0',
        },
        warning: {
          DEFAULT: '#B98A4A',
          tint: '#F6EFE4',
          bg: '#FDF9F2',
          border: '#F2E7D5',
        },
        error: {
          DEFAULT: '#D9462F',
          tint: '#FDEEEC',
          border: '#F6D9D4',
          text: '#A33A28',
        },
      },
      fontFamily: {
        // Archivo (variable, 700/800/900 used) — display/UI emphasis.
        // Space Grotesk (400-700) — body/default. Wired via next/font/local
        // in app/layout.tsx; these class names are exposed as CSS vars.
        display: ['var(--font-archivo)', 'Archivo', 'sans-serif'],
        body: ['var(--font-space-grotesk)', 'Space Grotesk', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // radius.card-row (18px) — list cards, stat cards, settings rows.
        card: '18px',
        // radius.card-lg (24px) — hero/feature cards (AI prompt card, up-next).
        cardLg: '24px',
        // Fully round pill — matches radius.chip (20px pill) / radius.round
        // (50%) depending on element height; 9999px works for both.
        pill: '9999px',
      },
      boxShadow: {
        // shadow.card — list cards, input cards.
        card: '0 5px 18px rgba(20,15,10,0.07)',
        // Derived hover state: same warm-black tint, deeper offset/blur.
        cardHover: '0 8px 24px rgba(20,15,10,0.10)',
        // shadow.card-lg — feature/hero cards.
        cardLg: '0 14px 38px rgba(20,15,10,0.10)',
        // shadow.cta — blush primary buttons.
        cta: '0 8px 20px rgba(229,138,161,0.35)',
        // shadow.subtle — toolbar buttons and inputs (redesign).
        subtle: '0 2px 8px rgba(20,15,10,0.05)',
      },
    },
  },
  plugins: [],
}
