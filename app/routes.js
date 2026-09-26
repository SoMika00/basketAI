import { createBrowserRouter, RouterProvider } from "@react-router-dom";
import { routes as appRoutes } from "./routes";

// Existing route definitions are imported from ./routes which uses file system based routing.
// To expose the OpenAPI spec at /api/openapi.json, we add a manual route entry.

export const router = createBrowserRouter([
  ...appRoutes,
  {
    path: "/api/openapi.json",
    element: null, // No React component needed for API route
    loader: async ({ request }) => {
      // Dynamically import the loader from the new route file
      const { loader } = await import("./routes/api.openapi.jsx");
      return loader({ request });
    },
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
