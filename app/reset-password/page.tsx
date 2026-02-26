'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Lock, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const supabase = createClient();

    // Supabase maneja el token del enlace automáticamente via el listener de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
      }
      setIsChecking(false);
    });

    // Timeout por si el evento no llega
    const timeout = setTimeout(() => {
      setIsChecking(false);
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({
        password: formData.password,
      });

      if (error) {
        toast.error('Error al actualizar la contraseña. El enlace puede haber expirado.');
        setIsLoading(false);
        return;
      }

      toast.success('Contraseña actualizada correctamente');
      router.push('/');
    } catch (error) {
      console.error('Reset password exception:', error);
      toast.error('Error al actualizar la contraseña');
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-emerald-50 via-teal-50 to-green-100 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-green-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <Card className="w-full max-w-md shadow-2xl border-emerald-100 relative z-10 backdrop-blur-sm bg-white/95">
        {isChecking ? (
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="h-8 w-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 text-sm">Verificando enlace...</p>
          </CardContent>
        ) : !isValidSession ? (
          <>
            <CardHeader className="space-y-3 pb-6">
              <CardTitle className="text-2xl font-bold text-center text-gray-800">
                Enlace inválido o expirado
              </CardTitle>
              <CardDescription className="text-center text-base text-gray-600">
                El enlace de restablecimiento no es válido o ha expirado. Solicita uno nuevo.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col space-y-3 pb-6">
              <Link href="/forgot-password" className="w-full">
                <Button className="w-full h-11 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium">
                  Solicitar nuevo enlace
                </Button>
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al inicio de sesión
              </Link>
            </CardFooter>
          </>
        ) : (
          <>
            <CardHeader className="space-y-3 pb-6">
              <CardTitle className="text-3xl font-bold text-center bg-linear-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent">
                Nueva contraseña
              </CardTitle>
              <CardDescription className="text-center text-base text-gray-600">
                Ingresa y confirma tu nueva contraseña
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-emerald-600" />
                    Nueva contraseña
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    minLength={6}
                    className="h-11 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-emerald-600" />
                    Confirmar contraseña
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    minLength={6}
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
                      Actualizando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      Actualizar contraseña
                    </span>
                  )}
                </Button>
              </CardFooter>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
