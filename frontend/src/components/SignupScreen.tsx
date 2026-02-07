import { useState } from 'react';
import { User } from '../App';
import { supabase } from '../utils/supabase/client';
import { BACKEND_URL } from '../utils/constants';
import { setAccessToken } from '../utils/authFetch';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Code2 } from 'lucide-react';

type Props = {
    onSignup: (user: User) => void;
    onSwitchToLogin: () => void;
};

export function SignupScreen({ onSignup, onSwitchToLogin }: Props) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchProfile = async (accessToken: string) => {
        const response = await fetch(`${BACKEND_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const data = await response.json();
        if (data.success && data.user) {
            return data.user;
        }
        throw new Error(data.error || 'Failed to fetch profile');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim() || !email.trim() || !password) {
            setError('All fields are required');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { data, error: authError } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    data: { name: name.trim() },
                },
            });

            if (authError) {
                setError(authError.message);
                return;
            }

            let accessToken = data.session?.access_token;

            if (!accessToken) {
                // Email confirmation may be enabled — sign in directly
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                });
                if (signInError) {
                    setError('Account created! Please check your email to confirm.');
                    return;
                }
                accessToken = signInData.session!.access_token;
            }

            setAccessToken(accessToken);
            const user = await fetchProfile(accessToken);
            onSignup(user);
        } catch (err: any) {
            console.error('Signup error:', err);
            setError(err.message || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
        setLoading(true);
        setError('');

        try {
            const { error: authError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (authError) {
                setError(authError.message);
                setLoading(false);
            }
            // If no error, browser will redirect to Google
        } catch (err: any) {
            console.error('Google signup error:', err);
            setError(err.message || 'Google signup failed');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-orange-50 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center">
                            <Code2 className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <h1 className="text-4xl mb-2 bg-gradient-to-r from-[#7622e5] to-[#ffa200] bg-clip-text text-transparent">
                        Edvance
                    </h1>
                    <p className="text-gray-600">Create your account</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    <h2 className="text-2xl mb-6 text-center">Sign Up</h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm mb-2 text-gray-700">
                                Your Name
                            </label>
                            <Input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your name"
                                className="w-full"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm mb-2 text-gray-700">
                                Email
                            </label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm mb-2 text-gray-700">
                                Password
                            </label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 6 characters"
                                className="w-full"
                                disabled={loading}
                            />
                        </div>

                        {error && (
                            <p className="text-sm text-red-600">{error}</p>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
                        >
                            {loading ? 'Creating account...' : 'Create Account'}
                        </Button>
                    </form>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-gray-500">or</span>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleGoogleSignup}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 border-gray-300 hover:bg-gray-50"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </Button>

                    <div className="mt-6 text-center">
                        <p className="text-gray-600 text-sm">
                            Already have an account?{' '}
                            <button
                                onClick={onSwitchToLogin}
                                className="text-[#7622e5] hover:underline font-medium"
                            >
                                Log in
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
