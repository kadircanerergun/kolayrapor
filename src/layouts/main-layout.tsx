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
      <div className="flex h-screen bg-background">
        <Sidebar className="w-64 border-r shadow-sm">
          <SidebarHeader className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileCheck className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-base truncate">Kolay Rapor</h2>
                <p className="text-xs text-muted-foreground">Eczane Yönetimi</p>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <User2 className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{credentials.username}</p>
                <p className="text-xs text-muted-foreground">Aktif Kullanıcı</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="px-4">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
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
                            "w-full justify-start h-10 px-3",
                            isActive && "bg-secondary text-secondary-foreground font-medium"
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
          
          <SidebarFooter className="p-4 space-y-4">
            <Separator />
            
            {/* Debug Mode Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bug className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="debug-mode" className="text-sm">Debug Modu</Label>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Switch
                      id="debug-mode"
                      checked={playwright.debugMode}
                      onCheckedChange={handleDebugToggle}
                      disabled={playwright.isLoading}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {playwright.debugMode 
                      ? "Tarayıcıyı göster (Debug açık)" 
                      : "Tarayıcıyı gizle (Debug kapalı)"
                    }
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground">
                {playwright.debugMode 
                  ? "Tarayıcı penceresi görünür olacak" 
                  : "Tarayıcı arka planda çalışacak"
                }
              </p>
            </div>
            
            <Separator />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-9"
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
              <p className="text-xs text-muted-foreground">© 2024 Kolay Rapor</p>
              <p className="text-xs text-muted-foreground">v1.0.0</p>
            </div>
          </SidebarFooter>
        </Sidebar>
        
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}