import { useState } from 'react';
import { Video, Lock, Mail, ArrowRight, Shield, Users, Sparkles } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('an.nguyenvan@company.com');
  const [password, setPassword] = useState('demo1234');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 800);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-700 via-primary-600 to-accent-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-accent-400/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Video size={24} />
            </div>
            <span className="text-xl font-bold">Smart Meeting Room</span>
          </div>

          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold leading-tight text-balance">
                Meetings that think with you.
              </h1>
              <p className="mt-4 text-lg text-white/80 max-w-md">
                Schedule, collaborate, and capture every decision with AI-powered transcription,
                minutes, and action items.
              </p>
            </div>

            <div className="space-y-4">
              {[
                { icon: Users, title: 'Interactive video conferencing', desc: 'Jitsi-powered rooms with lobby control' },
                { icon: Sparkles, title: 'AI transcription & minutes', desc: 'Real-time subtitles and automated MOM' },
                { icon: Shield, title: 'Enterprise-grade security', desc: 'Token-verified access, encrypted chat' },
              ].map((f) => (
                <div key={f.title} className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-white/15 backdrop-blur rounded-lg flex items-center justify-center shrink-0">
                    <f.icon size={20} />
                  </div>
                  <div>
                    <p className="font-semibold">{f.title}</p>
                    <p className="text-sm text-white/70">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-white/60">© 2026 SMR System. Version 1.0</p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-ink-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white">
              <Video size={22} />
            </div>
            <span className="text-lg font-bold text-ink-900">Smart Meeting Room</span>
          </div>

          <h2 className="text-2xl font-bold text-ink-900">Welcome back</h2>
          <p className="mt-2 text-sm text-ink-500">Sign in to your organization account</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-11"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-11"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-ink-600 cursor-pointer">
                <input type="checkbox" className="rounded border-ink-300 text-primary-600 focus:ring-primary-500/20" defaultChecked />
                Remember me
              </label>
              <button type="button" className="text-primary-600 hover:text-primary-700 font-medium">
                Forgot password?
              </button>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-ink-200">
            <p className="text-xs text-ink-500 text-center">
              Joining as a guest? Use a meeting link provided by your host.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
