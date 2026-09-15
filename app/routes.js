import { createRoutesFromElements, Route } from "@remix-run/react";
import { createBrowserRouter } from "react-router-dom";
import { rootRoute } from "./root.jsx";
import { chatRoute } from "./routes/chat.jsx";
import { indexRoute } from "./routes/_index/route.jsx";
import { appRoute } from "./routes/app.jsx";
import { authCallbackRoute } from "./routes/auth.callback.jsx";
import { authTokenStatusRoute } from "./routes/auth.token-status.jsx";
import { authDynamicRoute } from "./routes/auth.$.jsx";
import { webhooksRoute } from "./routes/api.webhooks.jsx";
import { toolsRoute } from "./routes/api.tools.jsx";

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={rootRoute}>
      <Route index element={indexRoute} />
      <Route path="chat" element={chatRoute} />
      <Route path="app" element={appRoute} />
      <Route path="auth" element={authDynamicRoute} />
      <Route path="auth/callback" element={authCallbackRoute} />
      <Route path="auth/token-status" element={authTokenStatusRoute} />
      <Route path="api/webhooks" element={webhooksRoute} />
      <Route path="api/tools" element={toolsRoute} />
    </Route>
  )
);
