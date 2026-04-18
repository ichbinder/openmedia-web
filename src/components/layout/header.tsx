"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, Film, LogIn, LogOut, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/auth-context";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Suche" },
  { href: "/genres", label: "Genres" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/downloads", label: "Downloads" },
  { href: "/bibliothek", label: "Bibliothek" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-cinema-gold transition-colors hover:text-cinema-gold/80"
        >
          <Film className="size-6" />
          <span className="text-lg font-bold tracking-tight">CineScope</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <div className="ml-2 border-l border-border/40 pl-2">
            {user ? (
              <div className="flex items-center gap-2">
                {user.isAdmin && (
                  <Link
                    href="/admin/config"
                    className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Admin Einstellungen"
                  >
                    <Settings className="size-4" />
                  </Link>
                )}
                <Link
                  href="/profile"
                  className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <User className="size-4" />
                  {user.name}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-cinema-gold transition-colors hover:text-cinema-gold/80"
              >
                <LogIn className="size-4" />
                Anmelden
              </Link>
            )}
          </div>
        </nav>

        {/* Mobile hamburger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Menü öffnen"
              />
            }
          >
            <Menu className="size-5" />
          </SheetTrigger>

          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              {navLinks.map((link) => (
                <SheetClose key={link.href} render={<span />}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex rounded-md px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {link.label}
                  </Link>
                </SheetClose>
              ))}
              <div className="mt-2 border-t border-border/40 pt-2">
                {user ? (
                  <>
                    {user.isAdmin && (
                      <SheetClose render={<span />}>
                        <Link
                          href="/admin/config"
                          className="flex items-center gap-2 rounded-md px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-muted"
                          onClick={() => setOpen(false)}
                        >
                          <Settings className="size-4" />
                          Konfiguration
                        </Link>
                      </SheetClose>
                    )}
                    <SheetClose render={<span />}>
                      <Link
                        href="/profile"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => setOpen(false)}
                      >
                        <User className="size-4" />
                        {user.name}
                      </Link>
                    </SheetClose>
                    <SheetClose render={<span />}>
                      <button
                        onClick={() => {
                          logout();
                          setOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        <LogOut className="size-4" />
                        Abmelden
                      </button>
                    </SheetClose>
                  </>
                ) : (
                  <SheetClose render={<span />}>
                    <Link
                      href="/login"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-md px-3 py-2.5 text-base font-medium text-cinema-gold transition-colors hover:bg-muted"
                    >
                      <LogIn className="size-4" />
                      Anmelden
                    </Link>
                  </SheetClose>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
