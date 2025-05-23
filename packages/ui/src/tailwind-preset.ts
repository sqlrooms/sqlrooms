import {Config} from 'tailwindcss';
import tailwindAnimate from 'tailwindcss-animate';
import typography from '@tailwindcss/typography';

export const sqlroomsTailwindPreset = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options?: Record<string, unknown>,
): Partial<Config> => ({
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: 'calc(var(--radius) - 4px)',
      },
      typography: {
        DEFAULT: {
          css: {
            // Improve spacing and styling for lists
            'ul, ol': {
              paddingLeft: '1.5em',
              marginTop: '0.75em',
              marginBottom: '0.75em',
            },
            'ul > li, ol > li': {
              marginTop: '0.25em',
              marginBottom: '0.25em',
            },
            // Better styling for code blocks
            pre: {
              backgroundColor: 'hsl(var(--muted))',
              color: 'hsl(var(--muted-foreground))',
              borderRadius: 'var(--radius)',
              padding: '1em',
              overflowX: 'auto',
            },
            code: {
              backgroundColor: 'hsl(var(--muted))',
              color: 'hsl(var(--muted-foreground))',
              borderRadius: '0.25em',
              padding: '0.2em 0.4em',
              fontSize: '0.875em',
            },
            // Better styling for blockquotes
            blockquote: {
              borderLeftColor: 'hsl(var(--border))',
              fontStyle: 'normal',
              color: 'hsl(var(--muted-foreground))',
            },
            // Harmonize heading styles
            'h1, h2, h3, h4, h5, h6': {
              color: 'hsl(var(--foreground))',
              fontWeight: '600',
            },
            // Better link styling
            a: {
              color: 'hsl(var(--primary))',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            },
            // Better table styling
            table: {
              width: '100%',
              tableLayout: 'auto',
              textAlign: 'left',
              borderCollapse: 'collapse',
            },
            th: {
              fontWeight: '600',
              borderBottomWidth: '2px',
              borderColor: 'hsl(var(--border))',
              padding: '0.5em',
            },
            td: {
              borderBottomWidth: '1px',
              borderColor: 'hsl(var(--border))',
              padding: '0.5em',
            },
          },
        },
        // Adjust typography for dark mode
        invert: {
          css: {
            color: 'hsl(var(--foreground))',
            pre: {
              backgroundColor: 'hsl(var(--muted))',
              color: 'hsl(var(--muted-foreground))',
            },
            code: {
              backgroundColor: 'hsl(var(--muted))',
              color: 'hsl(var(--muted-foreground))',
            },
            'h1, h2, h3, h4, h5, h6': {
              color: 'hsl(var(--foreground))',
            },
            blockquote: {
              borderLeftColor: 'hsl(var(--border))',
              color: 'hsl(var(--muted-foreground))',
            },
          },
        },
      },
      keyframes: {
        progress: {
          '0%': {transform: 'translateX(0) scaleX(0)'},
          '40%': {transform: 'translateX(0) scaleX(0.4)'},
          '100%': {transform: 'translateX(100%) scaleX(0.5)'},
        },
      },
      animation: {
        progress: 'progress 1s infinite linear',
      },
    },
  },
  plugins: [tailwindAnimate, typography],
});
