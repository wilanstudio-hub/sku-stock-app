import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { LangProvider } from "@/hooks/useLang";
import { FontSizeProvider } from "@/hooks/useFontSize";
import { TenantProvider } from "@/contexts/TenantContext";
import { GlobalAgentWidget } from "@/components/agent/GlobalAgentWidget";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import AdminPage from "./pages/AdminPage.tsx";
import ScanPage from "./pages/ScanPage.tsx";
import AIAgentPage from "./pages/AIAgentPage.tsx";
import UpdatePassword from "./pages/UpdatePassword.tsx";
import NotFound from "./pages/NotFound.tsx";

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
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/scan" element={<ScanPage />} />
                  <Route path="/ai-agent" element={<AIAgentPage />} />
                  <Route path="/update-password" element={<UpdatePassword />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <GlobalAgentWidget />
              </AuthProvider>
            </LangProvider>
          </FontSizeProvider>
        </TenantProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
