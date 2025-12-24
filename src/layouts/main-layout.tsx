import React, { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "@tanstack/react-router";
import { Sidebar, SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { LogOut, FileCheck, Users, Settings, Search, User2, Bug } from "lucide-react";
import { cn } from "@/utils/tailwind";
import { usePlaywright } from "@/hooks/usePlaywright";

interface Credentials {
  username: string;
  password: string;
  loginTime: string;
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const playwright = usePlaywright();

  useEffect(() => {
    const stored = localStorage.getItem('credentials');
    if (!stored) {
      navigate({ to: "/login" });
      return;
    }

    try {
      const creds = JSON.parse(stored);
      setCredentials(creds);
    } catch {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  useEffect(() => {
    // Initialize debug mode state from Playwright service
    playwright.getDebugMode();
  }, []);

  const handleDebugToggle = async (enabled: boolean) => {
    await playwright.setDebugMode(enabled);
    // If browser is already running, restart it with new mode
    if (playwright.isReady) {
      await playwright.restart();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('credentials');
    navigate({ to: "/" });
  };

  const menuItems = [
    {
      to: "/home",
      icon: FileCheck,
      label: "Rapor Doğrulama",
      description: "Ana sayfa ve rapor işlemleri"
    },
    {
      to: "/recete-arama",
      icon: Search,
      label: "Reçete Arama",
      description: "SGK sisteminde reçete sorgulama"
    },
    {
      to: "/hasta-bilgileri",
      icon: Users,
      label: "Hasta Bilgileri",
      description: "Hasta kayıtları ve bilgileri"
    },
    {
      to: "/ayarlar",
      icon: Settings,
      label: "Ayarlar",
      description: "Uygulama ayarları"
    }
  ];

  if (!credentials) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="bg-background flex h-screen">
        <Sidebar className="w-64 border-r shadow-sm">
          <SidebarHeader className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <FileCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold">
                  Kolay Rapor
                </h2>
                <p className="text-muted-foreground text-xs">Eczane Yönetimi</p>
              </div>
            </div>

            <Separator />

            <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
              <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full">
                <User2 className="text-primary h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {credentials.username}
                </p>
                <p className="text-muted-foreground text-xs">Aktif Kullanıcı</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-4">
            <div className="space-y-1">
              <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                Ana Menü
              </h4>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;

                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>
                      <Link to={item.to} className="block">
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          className={cn(
                            "h-10 w-full justify-start px-3",
                            isActive &&
                              "bg-secondary text-secondary-foreground font-medium",
                          )}
                        >
                          <Icon className="mr-3 h-4 w-4" />
                          {item.label}
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.description}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </SidebarContent>

          <SidebarFooter className="space-y-4 p-4">
            <Separator />

            {/* Debug Mode Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="debug-mode"
                        checked={playwright.debugMode}
                        onCheckedChange={handleDebugToggle}
                        disabled={playwright.isLoading}
                      />
                      <Label htmlFor="debug-mode">Debug Modu</Label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {playwright.debugMode
                      ? "Tarayıcıyı göster (Debug açık)"
                      : "Tarayıcıyı gizle (Debug kapalı)"}
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-muted-foreground text-xs">
                {playwright.debugMode
                  ? "Tarayıcı penceresi görünür olacak"
                  : "Tarayıcı arka planda çalışacak"}
              </p>
            </div>

            <Separator />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Çıkış Yap
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Uygulamadan çıkış yap
              </TooltipContent>
            </Tooltip>

            <div className="text-center">
              <p className="text-muted-foreground text-xs">
                © 2024 Kolay Rapor
              </p>
              <p className="text-muted-foreground text-xs">v1.0.0</p>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
