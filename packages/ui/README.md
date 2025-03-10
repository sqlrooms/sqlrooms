A comprehensive UI component library for SQLRooms applications, built on top of React and Tailwind CSS. This package provides a collection of reusable, accessible, and customizable components designed to create consistent and beautiful user interfaces.

This library is based on [shadcn/ui](https://ui.shadcn.com/), a collection of beautifully designed, accessible components that can be copied and pasted into your apps.

## Features

- 🎨 **Modern Design**: Clean, modern components following design best practices
- ♿ **Accessibility**: Components built with accessibility in mind
- 🌗 **Theming**: Support for light and dark modes
- 📱 **Responsive**: Mobile-friendly components that adapt to different screen sizes
- 🧩 **Composable**: Components designed to work together seamlessly
- 🔄 **React Hooks**: Useful hooks for common UI patterns

## Installation

```bash
npm install @sqlrooms/ui
# or
yarn add @sqlrooms/ui
```

## Basic Usage

### Using Components

```tsx
import {Button, Card, Input} from '@sqlrooms/ui';

function LoginForm() {
  return (
    <Card className="mx-auto max-w-md p-6">
      <h2 className="mb-4 text-2xl font-bold">Login</h2>
      <form>
        <div className="space-y-4">
          <div>
            <Input type="email" placeholder="Email" required />
          </div>
          <div>
            <Input type="password" placeholder="Password" required />
          </div>
          <Button type="submit" className="w-full">
            Sign In
          </Button>
        </div>
      </form>
    </Card>
  );
}
```

### Using Hooks

```tsx
import {useToast, useDisclosure} from '@sqlrooms/ui';

function MyComponent() {
  const {toast} = useToast();
  const {isOpen, onOpen, onClose} = useDisclosure();

  const handleAction = () => {
    // Perform some action
    toast({
      title: 'Success!',
      description: 'Your action was completed successfully.',
      variant: 'success',
    });
    onClose();
  };

  return (
    <div>
      <Button onClick={onOpen}>Open Dialog</Button>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>
              Are you sure you want to perform this action?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleAction}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

## Available Components

- **Layout**: Card, Resizable, Tabs
- **Forms**: Button, Checkbox, Input, Select, Slider, Switch, Textarea
- **Feedback**: Alert, Progress, Spinner, Toast
- **Navigation**: Accordion, Breadcrumb, Dropdown Menu
- **Overlay**: Dialog, Popover, Tooltip
- **Data Display**: Badge, Table
- **Utility**: Error Boundary, Theme Switch

## Advanced Features

- **Component Composition**: Build complex UIs by composing simple components
- **Form Handling**: Integrated with React Hook Form for easy form management
- **Custom Styling**: Extend components with custom styles using Tailwind CSS
- **Animation**: Smooth transitions and animations for interactive elements

For more information, visit the SQLRooms documentation.
