import BaseLayout from "@/layouts/base-layout";
import MainLayout from "@/layouts/main-layout";
import { Outlet, createRootRoute, useLocation } from "@tanstack/react-router";
import { Toaster } from "sonner";
/* import { TanStackRouterDevtools } from '@tanstack/react-router-devtools' */

/*
 * Uncomment the code in this file to enable the router devtools.
 */

function Root() {
  const location = useLocation();
  
  // Use minimal layout for landing page only
  const isLandingPage = location.pathname === '/';
  
  if (isLandingPage) {
    return (
      <>
        <Outlet />
        {/* <TanStackRouterDevtools /> */}
      </>
    );
  }
  
  return (
    <BaseLayout>
      <MainLayout>
        <Outlet />
        {/* <TanStackRouterDevtools /> */}
      </MainLayout>
      <Toaster position="top-right" richColors closeButton />
    </BaseLayout>
  );
}

export const Route = createRootRoute({
  component: Root,
});
