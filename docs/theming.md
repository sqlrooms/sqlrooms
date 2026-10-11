# Theming

SQLRooms uses [shadcn's](https://ui.shadcn.com/) CSS variables approach for theming, providing a flexible and maintainable way to manage color schemes and design tokens across the application.

## Theme Provider

The application uses `ThemeProvider` to manage theme state:

```tsx
<ThemeProvider defaultTheme="dark" storageKey="sqlrooms-ui-theme">
  <App />
</ThemeProvider>
```

### Props

- `defaultTheme`: Initial theme ("light" or "dark")
- `storageKey`: localStorage key for persisting theme preference

## Using Themes in Components

You can either use the pre-built `ThemeSwitch` component or implement one yourself like here:

```tsx
import {ThemeSwitch} from '@sqlrooms/ui';

function MyNavBarComponent() {
  return (
    <div>
      ...
      <ThemeSwitch />
    </div>
  );
}
```

Or with a custom implementation using `Button` and `useTheme`:

```tsx
import {useTheme, Button} from '@sqlrooms/ui';

function ThemeToggle() {
  const {theme, setTheme} = useTheme();

  return (
    <Button
      variant="outline"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      Toggle theme
    </Button>
  );
}
```

## CSS Variables

The theming system uses CSS custom properties in HSL format. These variables are defined in the global CSS:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;
  --radius: 0.5rem;
  --chart-1: 12 76% 61%;
  --chart-2: 173 58% 39%;
  --chart-3: 197 37% 24%;
  --chart-4: 43 74% 66%;
  --chart-5: 27 87% 67%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 224.3 76.3% 48%;
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;
}
```

### Variable Categories

- **Base Colors**
  - `--background` / `--foreground`: Main background and text colors
  - `--card` / `--card-foreground`: Card component colors
  - `--popover` / `--popover-foreground`: Popover/dropdown colors

- **Semantic Colors**
  - `--primary` / `--primary-foreground`: Primary action colors
  - `--secondary` / `--secondary-foreground`: Secondary action colors
  - `--muted` / `--muted-foreground`: Subdued UI elements
  - `--accent` / `--accent-foreground`: Emphasis and highlights
  - `--destructive` / `--destructive-foreground`: Error and deletion actions

- **UI Elements**
  - `--border`: Border colors
  - `--input`: Form input borders
  - `--ring`: Focus ring color
  - `--radius`: Border radius for components

- **Chart Colors**
  - `--chart-1` through `--chart-5`: Data visualization colors

### Using Variables in CSS

To use these variables in your components:

```css
.my-component {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}
```

#### Using with Tailwind Classes

The theme variables are mapped to Tailwind's color system, allowing you to use them directly in className props:

```tsx
import { Button, Input } from '@sqlrooms/ui';

// Basic usage
<div className="bg-background text-foreground">
  <Button className="bg-primary text-primary-foreground">
    Click me
  </Button>
</div>

// With hover states
<Button
  variant="secondary"
  className="hover:bg-secondary/90 text-secondary-foreground"
>
  Hover me
</Button>

// With opacity modifiers
<div className="bg-muted/50 text-muted-foreground">
  Semi-transparent background
</div>

// Border and ring utilities
<Input className="focus:ring-2 ring-ring" />

// Destructive actions
<Button
  variant="destructive"
  className="hover:bg-destructive/90"
>
  Delete
</Button>
```

These class names automatically adapt to the current theme, switching between light and dark mode values as appropriate.

#### Dark Mode Variants

You can explicitly specify different styles for light and dark modes using Tailwind's `dark:` modifier:

```tsx
import { Button } from '@sqlrooms/ui';

// Basic dark mode override
<div className="bg-white dark:bg-slate-950">
  Light and dark specific background
</div>

// Combining with theme variables
<div className="bg-background text-foreground">
  <div className="bg-card dark:bg-card/90 dark:text-card-foreground/90">
    Card with dark mode opacity
  </div>
</div>

// Complex component example
<Button
  variant="primary"
  className="
    hover:bg-primary/90
    dark:bg-primary/80
    dark:text-primary-foreground/90
    dark:hover:bg-primary/70
  "
>
  Adaptive Button
</Button>

// Multiple dark mode modifiers
<div className="
  bg-background
  text-foreground/80 dark:text-foreground/70
  border-border dark:border-border/50
  shadow-md dark:shadow-xl
">
  Complex Container
</div>
```

Note: The `dark:` modifier works automatically with our theme system - it will apply when the theme is set to "dark" through the ThemeProvider.

## Customizing Themes

To create or modify themes:

1. Visit the [shadcn theme generator](https://ui.shadcn.com/themes)
2. Customize colors interactively
3. Copy the generated CSS
4. Update your global CSS file with the new variables

## API Reference

For detailed API documentation, refer to:

- [ThemeProvider API](/api/ui/functions/ThemeProvider)
- [ThemeSwitch API](/api/ui/functions/ThemeSwitch)
- [useTheme Hook API](/api/ui/functions/useTheme)
