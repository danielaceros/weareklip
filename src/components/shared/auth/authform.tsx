"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type AuthFormProps = {
  email: string
  password: string
  isLogin: boolean
  loading: boolean
  setEmail: (email: string) => void
  setPassword: (password: string) => void
  handleSubmit: (e: React.FormEvent) => void
  toggleMode: () => void
}

export default function AuthForm({
  email,
  password,
  isLogin,
  loading,
  setEmail,
  setPassword,
  handleSubmit,
  toggleMode,
}: AuthFormProps) {
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="email"
        placeholder="Correo electrónico"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        disabled={loading}
      />
      <Input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete={isLogin ? "current-password" : "new-password"}
        disabled={loading}
      />
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Procesando..." : isLogin ? "Entrar" : "Registrarse"}
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
        <span
          onClick={toggleMode}
          className="text-blue-600 hover:underline cursor-pointer"
        >
          {isLogin ? "Regístrate" : "Inicia sesión"}
        </span>
      </p>
    </form>
  )
}
