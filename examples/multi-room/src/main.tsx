import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {
  createRouter,
  createRoute,
  createRootRoute,
  RouterProvider,
  Outlet,
  Link,
} from '@tanstack/react-router';
import {Toaster} from '@sqlrooms/ui';
import {RoomsListPage} from './RoomsListPage';
import {RoomPage} from './RoomPage';
import {seedDefaultRooms} from './rooms-list';
import './index.css';

const rootRoute = createRootRoute({
  component: () => (
    <div className="flex h-screen w-screen flex-col">
      <header className="bg-primary text-primary-foreground flex h-12 items-center gap-3 px-4">
        <Link to="/" className="text-sm font-semibold hover:underline">
          SQLRooms
        </Link>
        <span className="text-primary-foreground/60 text-xs">Multi-Room</span>
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <Toaster />
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: RoomsListPage,
});

const roomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/room/$id',
  component: RoomPage,
});

const routeTree = rootRoute.addChildren([indexRoute, roomRoute]);
const router = createRouter({routeTree});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

seedDefaultRooms();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
