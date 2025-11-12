import type React from 'react';
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

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
    <html lang="es">
      <body className={geist.className}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
