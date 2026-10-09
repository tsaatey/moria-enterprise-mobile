import type { IconName } from '@/components/ui/icon';

/** `buildSideNav()` in the mobile prototype, in the same order. */
export const NAV_ITEMS: { route: string; icon: IconName; label: string; ownerOnly?: boolean }[] = [
  { route: 'dashboard', icon: 'dashboard', label: 'Dashboard', ownerOnly: true },
  { route: 'pos', icon: 'point-of-sale', label: 'Point of Sale' },
  { route: 'customers', icon: 'groups', label: 'Customers & Debts' },
  // Prototype icon is `apparel` (Material Symbols only); `checkroom` is the closest MaterialIcons glyph.
  { route: 'products', icon: 'checkroom', label: 'Products', ownerOnly: true },
  { route: 'inventory', icon: 'inventory-2', label: 'Inventory' },
  { route: 'categories', icon: 'category', label: 'Categories', ownerOnly: true },
  { route: 'sms', icon: 'campaign', label: 'SMS Broadcasts', ownerOnly: true },
  { route: 'shops', icon: 'storefront', label: 'Manage Branches', ownerOnly: true },
  { route: 'staff', icon: 'badge', label: 'Staff & Roles', ownerOnly: true },
];

/** The four bottom tabs; the bar is hidden on every other screen, as in the prototype. */
export const MAIN_TABS = ['dashboard', 'pos', 'customers', 'inventory'] as const;
