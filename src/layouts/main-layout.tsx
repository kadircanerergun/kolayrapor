import React, { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
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
import {
  FileCheck,
  Settings,
  User2,
  CalendarIcon,
  History,
  Globe,
  Shield,
  Coins,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import logoSrc from "../../images/logo-transparent.svg";
import { cn } from "@/utils/tailwind";
import { usePlaywright } from "@/hooks/usePlaywright";
import { useCredentials } from "@/contexts/credentials-context";
import { usePharmacy } from "@/contexts/pharmacy-context";

const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();
  const { credentials } = useCredentials();
  const { pharmacy, subscription, creditBalance, products } = usePharmacy();
  const [testCaptchaData, setTestCaptchaData] = useState<{image: string | null, solution: string | null}>({image: null, solution: null});
  const playwright = usePlaywright();

  // Derive display values from pharmacy context
  const activePlanName = (() => {
    if (!subscription || subscription.status !== "active") return null;
    // Find matching product name from plans
    const matchedProduct = products.find((p) =>
      p.variants.some((v) => v.id === subscription.planId),
    );
    return matchedProduct?.name ?? null;
  })();

  const remainingCredit = creditBalance ? Number(creditBalance.balance) : null;

  // Sidebar collapsed state persisted in localStorage
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored === "true";
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

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


  const menuItems = [
    {
      to: "/home",
      icon: FileCheck,
      label: "Kontrol Merkezi",
      description: "Özet bilgiler ve son işlemler",
    },
    {
      to: "/gezinti",
      icon: Globe,
      label: "Medulada Kontrol",
      description: "SGK Medula portalında doğrudan gezinin",
    },
    {
      to: "/search-report",
      icon: CalendarIcon,
      label: "Toplu Kontrol",
      description: "Tarih aralığı ile rapor arama",
    },
    {
      to: "/son-islemler",
      icon: History,
      label: "Son İşlemler",
      description: "Daha önce sorgulanan reçeteler",
    },

    {
      to: "/ayarlar",
      icon: Settings,
      label: "Ayarlar",
      description: "Uygulama ayarları",
    },
  ];


  return (
    <TooltipProvider delayDuration={300}>
      <div className="bg-background flex h-screen">
        <Sidebar
          className={cn(
            "border-r shadow-sm transition-[width] duration-300 ease-in-out overflow-hidden",
            collapsed ? "w-[68px]" : "w-64",
          )}
        >
          <SidebarHeader className={cn("space-y-4 p-4", collapsed && "px-2")}>
            {/* Logo + App Name + Toggle */}
            <div className="flex items-center gap-3">
              <img
                src={logoSrc}
                alt="Kolay Rapor"
                className="h-8 w-8 shrink-0"
              />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold">
                    Kolay Rapor
                  </h2>
                  <p className="text-muted-foreground text-xs">Eczane Yönetimi</p>
                </div>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 ml-auto"
                    onClick={toggleCollapsed}
                  >
                    {collapsed ? (
                      <ChevronsRight className="h-4 w-4" />
                    ) : (
                      <ChevronsLeft className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
                </TooltipContent>
              </Tooltip>
            </div>
          </SidebarHeader>

          <SidebarContent className={cn("px-4 flex flex-col gap-1", collapsed && "px-2")}>
            <div className="space-y-1 flex-1">
              {!collapsed && (
                <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                  Ana Menü
                </h4>
              )}
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;

                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>
                      <Link to={item.to} className="block">
                        <Button
                          variant="ghost"
                          className={cn(
                            "h-10 w-full",
                            collapsed
                              ? "justify-center px-0"
                              : "justify-start px-3",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-primary font-medium hover:bg-sidebar-accent hover:text-sidebar-primary"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              !collapsed && "mr-3",
                            )}
                          />
                          {!collapsed && item.label}
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {collapsed ? item.label : item.description}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            <div className="border-t height-fit flex justify-end gap-2 flex-col" >
                   {!collapsed && <Separator />}

            {/* User Info — only show when pharmacy is registered */}
            {pharmacy && (
              <>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="bg-sidebar-primary/10 mx-auto flex h-8 w-8 items-center justify-center rounded-full">
                        <User2 className="text-sidebar-primary h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {pharmacy.name || credentials?.username || "Kullanıcı Yok"}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
                    <div className="bg-sidebar-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                      <User2 className="text-sidebar-primary h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {pharmacy.nameSurname || pharmacy.name || credentials?.username || "Kullanıcı Yok"}
                      </p>
                      <p className="text-muted-foreground text-xs truncate">
                        {pharmacy.name}
                      </p>
                    </div>
                  </div>
                )}

                {/* License and Credit Info */}
                {!collapsed && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/50 rounded-lg p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="h-3.5 w-3.5 text-sidebar-primary" />
                        <span className="text-xs text-muted-foreground">Aktif Lisans</span>
                      </div>
                      <p className="text-sm font-medium truncate">
                        {activePlanName || "—"}
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <Coins className="h-3.5 w-3.5 text-sidebar-primary" />
                        <span className="text-xs text-muted-foreground">Kalan Kredi</span>
                      </div>
                      <p className="text-sm font-medium">
                        {remainingCredit !== null ? remainingCredit : "—"}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
            </div>
          </SidebarContent>

          <SidebarFooter className={cn("space-y-2 mb-4", collapsed && "px-2")}>

            {/* Debug Mode Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "flex items-center",
                      collapsed ? "justify-center w-full" : "space-x-2",
                    )}>
                      <Switch
                        id="debug-mode"
                        checked={playwright.debugMode}
                        onCheckedChange={handleDebugToggle}
                        disabled={playwright.isLoading}
                      />
                      {!collapsed && (
                        <Label htmlFor="debug-mode">Debug Modu</Label>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {playwright.debugMode
                      ? "Tarayıcıyı göster (Debug açık)"
                      : "Tarayıcıyı gizle (Debug kapalı)"}
                  </TooltipContent>
                </Tooltip>
              </div>

              {!collapsed && (
                <>
                  <p className="text-muted-foreground text-xs">
                    {playwright.debugMode
                      ? "Tarayıcı penceresi görünür olacak"
                      : "Tarayıcı arka planda çalışacak"}
                  </p>
                </>
              )}
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
