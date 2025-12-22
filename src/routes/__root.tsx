import BaseLayout from "@/layouts/base-layout";
import { Outlet, createRootRoute, useLocation } from "@tanstack/react-router";
/* import { TanStackRouterDevtools } from '@tanstack/react-router-devtools' */

/*
 * Uncomment the code in this file to enable the router devtools.
 */

function Root() {
  const location = useLocation();
  
  // Use minimal layout for login and landing pages
  const isAuthPage = location.pathname === '/login' || location.pathname === '/';
  
  if (isAuthPage) {
    return (
      <>
        <Outlet />
        {/* <TanStackRouterDevtools /> */}
      </>
    );
  }
  
  return (
    <BaseLayout>
      <Outlet />
      {/* <TanStackRouterDevtools /> */}
    </BaseLayout>
  );
}

export const Route = createRootRoute({
  component: Root,
});
