'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      console.log('Tentando fazer login...')
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('Resposta do login:', { data, error })

      if (error) {
        console.error('Erro no login:', error)
        alert('Erro no login: ' + error.message)
      } else if (data?.user) {
        console.log('Login bem sucedido!')
        router.push('/dashboard')
      }
    } catch (err) {
      console.error('Erro inesperado:', err)
      alert('Erro inesperado durante o login')
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">LAÇOS 3.0 - ULTIMATE</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 bg-gray-700 text-white rounded-lg"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 bg-gray-700 text-white rounded-lg"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}