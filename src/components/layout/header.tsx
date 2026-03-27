"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Suche" },
  { href: "/genres", label: "Genres" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);

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
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
