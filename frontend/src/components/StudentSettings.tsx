import { useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Save,
  Trash2,
  Lock,
  User as UserIcon,
  Shield,
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { authFetch } from '../utils/authFetch';
import { supabase } from '../utils/supabase/client';
import { User } from '../App';

interface StudentSettingsPanelProps {
  user: User;
  onLogout: () => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } }),
};

export function StudentSettingsPanel({ user, onLogout }: StudentSettingsPanelProps) {
  const [name, setName] = useState(user.name);
  const [savingProfile, setSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSaveProfile = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Name cannot be empty'); return; }
    try {
      setSavingProfile(true);
      const response = await authFetch('/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await response.json();
      if (data.success) toast.success('Profile updated');
      else toast.error(data.error || 'Failed to update profile');
    } catch { toast.error('Failed to update profile'); }
    finally { setSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    try {
      setChangingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) toast.error(error.message || 'Failed to change password');
      else { toast.success('Password changed successfully'); setNewPassword(''); setConfirmPassword(''); }
    } catch { toast.error('Failed to change password'); }
    finally { setChangingPassword(false); }
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleting(true);
      const response = await authFetch('/users/account', { method: 'DELETE' });
      const data = await response.json();
      if (data.success) { toast.success('Account deleted'); setDeleteDialogOpen(false); onLogout(); }
      else toast.error(data.error || 'Failed to delete account');
    } catch { toast.error('Failed to delete account'); }
    finally { setDeleting(false); }
  };

  return (
    <>
      <div className="mx-auto max-w-3xl">
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
          <p className="mt-1 text-sm text-slate-500">Manage your profile and account</p>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
          <Tabs defaultValue="profile">
            <TabsList className="mb-6">
              <TabsTrigger value="profile"><UserIcon className="mr-1.5 h-4 w-4" />Profile</TabsTrigger>
              <TabsTrigger value="account"><Shield className="mr-1.5 h-4 w-4" />Account</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card>
                <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  {user.profilePictureUrl && (
                    <div className="flex items-center gap-4">
                      <img src={user.profilePictureUrl} alt={user.name} className="h-16 w-16 rounded-full object-cover" />
                    </div>
                  )}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                    <Input value={user.email || ''} disabled className="bg-slate-50 text-slate-500" />
                    <p className="mt-1 text-xs text-slate-400">Email is managed by your login provider and cannot be changed here.</p>
                  </div>
                  <Button onClick={handleSaveProfile} disabled={savingProfile || name.trim() === user.name} className="bg-teal-600 hover:bg-teal-700">
                    <Save className="mr-2 h-4 w-4" />{savingProfile ? 'Saving...' : 'Save Profile'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="account">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />Change Password</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">New Password</label>
                      <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Confirm Password</label>
                      <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" />
                    </div>
                    <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword || !confirmPassword} className="bg-teal-600 hover:bg-teal-700">
                      {changingPassword ? 'Changing...' : 'Update Password'}
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-red-200">
                  <CardContent>
                    <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 mt-5" onClick={() => setDeleteDialogOpen(true)}>
                      <Trash2 className="mr-2 h-4 w-4" />Delete My Account
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Are you sure?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">This will permanently delete your account and all your project data. You will be logged out and won't be able to recover this account.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleDeleteAccount} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Yes, Delete My Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
