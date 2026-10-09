import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useSession } from '@/auth/session-store';
import { AppHeader } from '@/components/app-header';
import { SideDrawer } from '@/components/side-drawer';
import { showToast, ToastHost } from '@/components/ui/toast';
import { Icon, type IconName } from '@/components/ui/icon';
import { MAIN_TABS } from '@/navigation/nav-items';
import { useSyncStore } from '@/sync/sync-store';
import { useAutoSync } from '@/sync/use-auto-sync';
import { colors, fonts } from '@/theme/tokens';

const TAB_META: Record<(typeof MAIN_TABS)[number], { title: string; icon: IconName }> = {
  dashboard: { title: 'Dashboard', icon: 'dashboard' },
  pos: { title: 'Sales', icon: 'point-of-sale' },
  customers: { title: 'Customers', icon: 'groups' },
  inventory: { title: 'Inventory', icon: 'inventory-2' },
};

/**
 * Prototype `screen-main`: header (menu · logo · sync), four bottom tabs, and
 * a side drawer reaching every screen. The tab bar shows only on the four
 * main tabs; owner-only screens are not routable for a salesperson.
 */
export default function AppLayout() {
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const syncNow = useAutoSync();
  const pending = useSyncStore((s) => s.pending);

  if (!user) return null;
  const isOwner = user.role === 'owner';

  const tab = (name: (typeof MAIN_TABS)[number]) => (
    <Tabs.Screen
      name={name}
      options={{
        title: TAB_META[name].title,
        tabBarIcon: ({ color }) => <Icon name={TAB_META[name].icon} color={color} size={22} />,
      }}
    />
  );
  const hiddenTab = (name: string) => <Tabs.Screen name={name} options={{ href: null, tabBarStyle: { display: 'none' } }} />;

  return (
    <>
      <Tabs
        screenOptions={{
          header: () => (
            <AppHeader
              onMenu={() => setDrawerOpen(true)}
              onSync={() => {
                // Say why the last attempt failed before trying again.
                const { phase, lastError } = useSyncStore.getState();
                if (phase === 'error' && lastError) showToast(`Last sync failed — ${lastError}`);
                else if (phase === 'offline') showToast('Offline — will sync when connected');
                syncNow();
              }}
            />
          ),
          tabBarActiveTintColor: colors.regalPlum,
          tabBarInactiveTintColor: colors.onSurfaceVariant,
          tabBarLabelStyle: { fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 0.3 },
          tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.lavenderMist },
          sceneStyle: { backgroundColor: colors.background },
        }}>
        <Tabs.Protected guard={isOwner}>{tab('dashboard')}</Tabs.Protected>
        {tab('pos')}
        {tab('customers')}
        {tab('inventory')}
        <Tabs.Protected guard={isOwner}>
          {hiddenTab('products')}
          {hiddenTab('categories')}
          {hiddenTab('sms')}
          {hiddenTab('shops')}
          {hiddenTab('staff')}
        </Tabs.Protected>
      </Tabs>
      <ToastHost />
      <SideDrawer
        open={drawerOpen}
        user={user}
        onClose={() => setDrawerOpen(false)}
        onNavigate={(route) => {
          setDrawerOpen(false);
          router.navigate(`/${route}` as never);
        }}
        onSignOut={() => {
          setDrawerOpen(false);
          if (!pending) return void logout();
          // Queued records are tagged with this user and stay on the phone;
          // they go up the next time this user signs in here.
          Alert.alert(
            'Unsynced records',
            `${pending} ${pending === 1 ? 'record has' : 'records have'} not reached the server yet. They stay on this phone and sync the next time you sign in here.`,
            [
              { text: 'Sync Now', onPress: syncNow },
              { text: 'Sign Out', style: 'destructive', onPress: () => void logout() },
            ],
          );
        }}
      />
    </>
  );
}
