import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { LangProvider } from "@/hooks/useLang";
import { FontSizeProvider } from "@/hooks/useFontSize";
import { TenantProvider } from "@/contexts/TenantContext";
import Index from "./pages/Index.tsx";

// Lazy-loaded: keeps these out of the initial bundle so a first-time visitor
// (or anyone re-hitting "/" or "/auth") only downloads/JIT-compiles the code
// for the page they're actually on. iOS WebKit has crashed the renderer with
// "Can't open this page" (before any JS runs at all) when the initial bundle
// got too large — see vite.config.ts manualChunks and the git history of
// index.html for the other iOS-WebKit-crash fixes this pairs with.
const Auth = lazy(() => import("./pages/Auth.tsx"));
const AdminPage = lazy(() => import("./pages/AdminPage.tsx"));
const ScanPage = lazy(() => import("./pages/ScanPage.tsx"));
const AIAgentPage = lazy(() => import("./pages/AIAgentPage.tsx"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const GlobalAgentWidget = lazy(() =>
  import("@/components/agent/GlobalAgentWidget").then((m) => ({ default: m.GlobalAgentWidget }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <TenantProvider>
          <FontSizeProvider>
            <LangProvider>
              <AuthProvider>
                <Suspense fallback={null}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/scan" element={<ScanPage />} />
                    <Route path="/ai-agent" element={<AIAgentPage />} />
                    <Route path="/update-password" element={<UpdatePassword />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                <Suspense fallback={null}>
                  <GlobalAgentWidget />
                </Suspense>
              </AuthProvider>
            </LangProvider>
          </FontSizeProvider>
        </TenantProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
