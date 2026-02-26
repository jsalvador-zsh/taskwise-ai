'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Mail, ArrowLeft, Send } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      });

      if (error) {
        if (error.status === 429 || error.message?.toLowerCase().includes('rate limit')) {
          toast.error('Demasiados intentos. Espera unos minutos antes de volver a intentarlo.');
        } else {
          toast.error('Error al enviar el correo. Verifica la dirección e inténtalo de nuevo.');
        }
        setIsLoading(false);
        return;
      }

      setEmailSent(true);
    } catch (error) {
      console.error('Forgot password exception:', error);
      toast.error('Error al procesar la solicitud');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-emerald-50 via-teal-50 to-green-100 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-green-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <Card className="w-full max-w-md shadow-2xl border-emerald-100 relative z-10 backdrop-blur-sm bg-white/95">
        {!emailSent ? (
          <>
            <CardHeader className="space-y-3 pb-6">
              <CardTitle className="text-3xl font-bold text-center bg-linear-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent">
                Restablecer contraseña
              </CardTitle>
              <CardDescription className="text-center text-base text-gray-600">
                Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-emerald-600" />
                    Correo electrónico
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4 pt-2">
                <Button
                  type="submit"
                  className="w-full h-11 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Enviando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="h-5 w-5" />
                      Enviar enlace
                    </span>
                  )}
                </Button>
                <Link
                  href="/login"
                  className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al inicio de sesión
                </Link>
              </CardFooter>
            </form>
          </>
        ) : (
          <>
            <CardHeader className="space-y-3 pb-6">
              <div className="flex justify-center mb-2">
                <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Mail className="h-8 w-8 text-emerald-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-center bg-linear-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent">
                Correo enviado
              </CardTitle>
              <CardDescription className="text-center text-base text-gray-600">
                Hemos enviado un enlace de restablecimiento a{' '}
                <span className="font-semibold text-gray-800">{email}</span>.
                Revisa tu bandeja de entrada y sigue las instrucciones.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col space-y-4 pt-2 pb-6">
              <p className="text-xs text-center text-gray-500">
                ¿No recibiste el correo? Revisa tu carpeta de spam o{' '}
                <button
                  onClick={() => setEmailSent(false)}
                  className="text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
                >
                  inténtalo de nuevo
                </button>
                .
              </p>
              <Link
                href="/login"
                className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al inicio de sesión
              </Link>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
