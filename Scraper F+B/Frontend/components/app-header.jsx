'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LayoutDashboard, Package, Clock } from 'lucide-react';

export default function AppHeader({ isConnected = false }) {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      href: '/products',
      label: 'Products',
      icon: Package,
    },
    {
      href: '/crons',
      label: 'Crons',
      icon: Clock,
    },
  ];

  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-base font-bold tracking-tight">ASOS Scraper</h1>
            <nav className="flex gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                
                return (
                  <Link key={item.href} href={item.href}>
                    <Button 
                      variant={isActive ? 'default' : 'ghost'} 
                      size="sm" 
                      className="h-7 text-xs font-medium gap-1.5"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={isConnected ? 'default' : 'outline'} className="text-xs h-6 px-2.5">
              <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {isConnected ? 'Live' : 'Offline'}
            </Badge>
          </div>
        </div>
      </div>
    </header>
  );
}
