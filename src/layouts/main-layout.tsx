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
  const [testCaptchaData, setTestCaptchaData] = useState<{image: string | null, solution: string | null}>({image: null, solution: null});
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

      // Also send credentials to Playwright service so they're always available
      playwright.setCredentials(creds).catch(console.error);
    } catch {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  useEffect(() => {
    // Initialize debug mode from localStorage and sync with Playwright service
    const initializeDebugMode = async () => {
      const storedDebugMode = localStorage.getItem('debugMode');
      if (storedDebugMode !== null) {
        const isDebugEnabled = JSON.parse(storedDebugMode);
        await playwright.setDebugMode(isDebugEnabled);
      } else {
        // Get current debug mode from Playwright service if nothing stored
        await playwright.getDebugMode();
      }
    };

    initializeDebugMode().catch(console.error);

    // Global console.log interception for captcha debug
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      if (args[0] === 'CAPTCHA_DEBUG' && args[1]) {
        try {
          const data = typeof args[1] === 'string' ? JSON.parse(args[1]) : args[1];
          // Update the test captcha state for demo purposes
          setTestCaptchaData({
            image: data.image || null,
            solution: data.solution || null
          });
        } catch (e) {
          console.error('Failed to parse captcha debug data:', e);
        }
      }
      originalConsoleLog.apply(console, args);
    };

    return () => {
      console.log = originalConsoleLog;
    };
  }, []);

  const handleDebugToggle = async (enabled: boolean) => {
    // Save debug mode setting to localStorage for persistence
    localStorage.setItem('debugMode', JSON.stringify(enabled));

    await playwright.setDebugMode(enabled);
    // If browser is already running, restart it with new mode
    if (playwright.isReady) {
      await playwright.restart();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('credentials');
    // Optionally keep debug mode setting across logouts - comment out next line if you want to keep it
    // localStorage.removeItem('debugMode');
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
      to: "/search-report",
      icon: Search,
      label: "Rapor Arama",
      description: "SGK sisteminde recete numarasi ya da tarih ile arama"
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

            {/* Captcha Debug Area */}
            {playwright.debugMode && (playwright.captchaImage || playwright.captchaSolution || testCaptchaData.image || testCaptchaData.solution) && (
              <div className="space-y-2 p-2 bg-muted/30 rounded-lg border">
                <div className="text-xs font-medium text-muted-foreground">Captcha Debug</div>
                {(playwright.captchaImage || testCaptchaData.image) && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Detected Image:</div>
                    <img
                      src={`data:image/png;base64,${playwright.captchaImage || testCaptchaData.image}`}
                      alt="Captcha"
                      className="w-full max-w-32 border rounded"
                    />
                  </div>
                )}
                {(playwright.captchaSolution || testCaptchaData.solution) && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Solution:</div>
                    <div className="text-sm font-mono bg-background px-2 py-1 rounded border">
                      {playwright.captchaSolution || testCaptchaData.solution}
                    </div>
                  </div>
                )}
              </div>
            )}

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

              {/* Test Captcha Button - Only in Debug Mode */}
              {playwright.debugMode && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={() => {
                      // Simulate captcha debug data for testing
                      console.log('CAPTCHA_DEBUG', {
                        image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                        solution: '12345'
                      });
                    }}
                  >
                    Test Captcha Display
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={async () => {
                      // Test if credentials are available on Playwright side
                      const hasCredentials = await playwright.hasCredentials();
                      const storedCredentials = await playwright.getStoredCredentials();
                      console.log('Playwright has credentials:', hasCredentials.hasCredentials);
                      console.log('Stored credentials:', storedCredentials.credentials);
                    }}
                  >
                    Check Credentials
                  </Button>
                </>
              )}
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
