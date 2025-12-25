/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['Inter', 'sans-serif'],
			display: ['Inter', 'system-ui', 'sans-serif'],
  			mono: ['JetBrains Mono', 'monospace'],
        hand: ['Architects Daughter', 'cursive', 'sans-serif']
  		},
  		colors: {
        paper: {
          DEFAULT: '#FDFBF7',
          dark: '#F5F2ED',
        },
        ink: {
          DEFAULT: '#2D3436',
          muted: '#636E72',
        },
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			ring: 'hsl(var(--ring))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  		},
  		boxShadow: {
  			hard: '4px 4px 0px 0px rgba(0, 0, 0, 1)',
        'hard-sm': '2px 2px 0px 0px rgba(0, 0, 0, 1)',
        'hard-lg': '8px 8px 0px 0px rgba(0, 0, 0, 1)',
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")]
}