import type React from 'react';
import type { Metadata } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { cn } from "@/lib/utils";

const jetbrainsMono = JetBrains_Mono({subsets:['latin'],variable:'--font-mono'});

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TaskWise - Gestor de Tareas',
  description: 'Aplicación simple para gestionar tus tareas',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={cn("font-mono", jetbrainsMono.variable)}>
      <body className={geist.className}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
