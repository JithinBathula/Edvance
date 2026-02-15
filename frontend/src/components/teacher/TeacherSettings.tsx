import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  GraduationCap,
  Activity,
  Target,
  LogOut,
  ArrowLeft,
  Save,
  Trash2,
  Lock,
  User as UserIcon,
  Settings2,
  Shield,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { authFetch } from '../../utils/authFetch';
import { supabase } from '../../utils/supabase/client';
import { User } from '../../App';

interface TeacherSettingsProps {
  user: User;
  onUserUpdate: (fields: Partial<User>) => void;
  onLogout: () => void;
}

export function TeacherSettings({ user, onUserUpdate, onLogout }: TeacherSettingsProps) {
  const navigate = useNavigate();

  // Profile tab
  const [name, setName] = useState(user.name);
  const [savingProfile, setSavingProfile] = useState(false);

  // Classroom Defaults tab
  const [defaultDescription, setDefaultDescription] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Account tab
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoadingSettings(true);
      const response = await authFetch('/teacher/settings');
      const data = await response.json();
      if (data.success && data.settings) {
        setDefaultDescription(data.settings.default_description || '');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSaveProfile = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Name cannot be empty');
      return;
    }

    try {
      setSavingProfile(true);
      const response = await authFetch('/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await response.json();
      if (data.success) {
        onUserUpdate({ name: trimmed });
        toast.success('Profile updated');
      } else {
        toast.error(data.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const response = await authFetch('/teacher/settings', {
        method: 'PUT',
        body: JSON.stringify({
          default_description: defaultDescription,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Settings saved');
      } else {
        toast.error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setChangingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message || 'Failed to change password');
      } else {
        toast.success('Password changed successfully');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleting(true);
      const response = await authFetch('/users/account', { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        toast.success('Account deleted');
        setDeleteDialogOpen(false);
        onLogout();
      } else {
        toast.error(data.error || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar — same layout as TeacherDashboard */}
      <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <GraduationCap className="mr-2 h-6 w-6 text-teal-600" />
          <span className="bg-gradient-to-r from-teal-600 to-amber-500 bg-clip-text text-xl font-bold text-transparent">
            Edvance
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <button
            onClick={() => navigate('/teacher/dashboard')}
            className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <Activity className="mr-3 h-5 w-5" />
            Dashboard
          </button>
          <button className="flex w-full items-center rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-600">
            <Target className="mr-3 h-5 w-5" />
            Settings
          </button>
        </nav>

        <div className="border-t border-gray-200 p-4">
          <Button variant="outline" className="w-full justify-start" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl p-8">
          {/* Header */}
          <div className="mb-8 flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/teacher/dashboard')}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
              <p className="mt-1 text-gray-600">
                Manage your profile, classroom defaults, and account
              </p>
            </div>
          </div>

          <Tabs defaultValue="profile">
            <TabsList className="mb-6">
              <TabsTrigger value="profile">
                <UserIcon className="mr-1.5 h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="classroom">
                <Settings2 className="mr-1.5 h-4 w-4" />
                Classroom Defaults
              </TabsTrigger>
              <TabsTrigger value="account">
                <Shield className="mr-1.5 h-4 w-4" />
                Account
              </TabsTrigger>
            </TabsList>

            {/* ── Profile Tab ─────────────────────────── */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar */}
                  {user.profilePictureUrl && (
                    <div className="flex items-center gap-4">
                      <img
                        src={user.profilePictureUrl}
                        alt={user.name}
                        className="h-16 w-16 rounded-full object-cover"
                      />
                    </div>
                  )}

                  {/* Name */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>

                  {/* Email (read-only) */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <Input
                      value={user.email || ''}
                      disabled
                      className="bg-gray-50 text-gray-500"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Email is managed by your login provider and cannot be changed here.
                    </p>
                  </div>

                  <Button
                    onClick={handleSaveProfile}
                    disabled={savingProfile || name.trim() === user.name}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Classroom Defaults Tab ──────────────── */}
            <TabsContent value="classroom">
              <Card>
                <CardHeader>
                  <CardTitle>Classroom Defaults</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {loadingSettings ? (
                    <div className="flex justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Default Description
                        </label>
                        <textarea
                          value={defaultDescription}
                          onChange={(e) => setDefaultDescription(e.target.value)}
                          placeholder="Default description applied to new classrooms"
                          rows={3}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                        <p className="mt-1 text-xs text-gray-400">
                          This description will be pre-filled when creating new classrooms.
                        </p>
                      </div>

                      <Button
                        onClick={handleSaveSettings}
                        disabled={savingSettings}
                        className="bg-teal-600 hover:bg-teal-700"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {savingSettings ? 'Saving...' : 'Save Defaults'}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Account Tab ─────────────────────────── */}
            <TabsContent value="account">
              <div className="space-y-6">
                {/* Change Password */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Change Password
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        New Password
                      </label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Confirm Password
                      </label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                      />
                    </div>
                    <Button
                      onClick={handleChangePassword}
                      disabled={changingPassword || !newPassword || !confirmPassword}
                      className="bg-teal-600 hover:bg-teal-700"
                    >
                      {changingPassword ? 'Changing...' : 'Update Password'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Delete Account */}
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <Trash2 className="h-5 w-5" />
                      Delete Account
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-sm text-gray-600">
                      This will permanently anonymize your account and deactivate all your classrooms.
                      This action cannot be undone.
                    </p>
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete My Account
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This will permanently anonymize your account data and deactivate all your classrooms.
            You will be logged out and won't be able to recover this account.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteAccount}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Yes, Delete My Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
