import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Spinner } from "@/components/ui/spinner";
import { useEffect } from "react";

function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = () => {
      const stored = localStorage.getItem('credentials');
      if (stored) {
        try {
          const creds = JSON.parse(stored);
          if (creds.username && creds.password) {
            navigate({ to: "/home" });
            return;
          }
        } catch {
          // Invalid credentials, continue to login
        }
      }
      
      // If no valid credentials, go to login after delay
      setTimeout(() => {
        navigate({ to: "/login" });
      }, 2000);
    };

    checkAuth();
  }, [navigate]);

  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-3xl font-bold text-center">
          Eczane Rapor Doğrulama
        </h1>
        <p className="text-muted-foreground text-center">
          Rapor doğrulama işlemi başlatılıyor...
        </p>
        <Spinner size="lg" />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: LandingPage,
});
