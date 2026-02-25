import { useState } from 'react';
import { CheckCircle2, ChevronDown, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { supabase } from '@/lib/supabase';

const COUNTRY_CODES = [
  { code: '+65', country: 'SG', flag: '🇸🇬' },
  { code: '+91', country: 'IN', flag: '🇮🇳' },
  { code: '+1', country: 'US', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+61', country: 'AU', flag: '🇦🇺' },
  { code: '+86', country: 'CN', flag: '🇨🇳' },
  { code: '+81', country: 'JP', flag: '🇯🇵' },
  { code: '+82', country: 'KR', flag: '🇰🇷' },
  { code: '+60', country: 'MY', flag: '🇲🇾' },
  { code: '+62', country: 'ID', flag: '🇮🇩' },
  { code: '+66', country: 'TH', flag: '🇹🇭' },
  { code: '+63', country: 'PH', flag: '🇵🇭' },
  { code: '+84', country: 'VN', flag: '🇻🇳' },
  { code: '+49', country: 'DE', flag: '🇩🇪' },
  { code: '+33', country: 'FR', flag: '🇫🇷' },
  { code: '+971', country: 'AE', flag: '🇦🇪' },
];

interface WaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WaitlistModal({ open, onOpenChange }: WaitlistModalProps) {
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+65');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage('');

    try {
      if (!supabase) {
        setErrorMessage('Service is not configured. Please try again later.');
        setStatus('error');
        return;
      }

      const fullPhone = `${countryCode} ${phone.trim()}`;
      const { error } = await supabase
        .from('waitlist')
        .insert([{ email: email.trim().toLowerCase(), phone: fullPhone }]);

      if (error) {
        if (error.code === '23505') {
          setErrorMessage("You're already on the waitlist! We'll be in touch soon.");
          setStatus('error');
        } else {
          setErrorMessage('Something went wrong. Please try again.');
          setStatus('error');
        }
        return;
      }

      setStatus('success');
    } catch {
      setErrorMessage('Network error. Please check your connection.');
      setStatus('error');
    }
  };

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setTimeout(() => {
        setEmail('');
        setCountryCode('+65');
        setPhone('');
        setStatus('idle');
        setErrorMessage('');
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {status === 'success' ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-teal-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">You're on the list!</h3>
            <p className="mt-2 text-slate-500">We'll notify you when Edvance launches.</p>
            <Button
              onClick={() => handleOpenChange(false)}
              variant="outline"
              className="mt-6"
            >
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="text-center">
              <DialogTitle className="text-2xl font-bold text-center">
                Join the Waitlist
              </DialogTitle>
              <DialogDescription className="text-center text-slate-500">
                Be the first to experience AI-powered coding education.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex gap-2 mt-1.5">
                  <div className="relative">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="appearance-none h-10 pl-3 pr-8 rounded-md border border-border bg-input-background text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="9123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="flex-1"
                  />
                </div>
              </div>

              {status === 'error' && (
                <p className="text-sm text-red-500 text-center">{errorMessage}</p>
              )}

              <Button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white h-11 text-base"
              >
                {status === 'submitting' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Join the Waitlist'
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
