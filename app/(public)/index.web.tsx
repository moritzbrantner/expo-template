import '@/styles/web-shell.css';

import {
  Badge,
  Button,
  Card,
  Kbd,
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@moritzbrantner/ui';
import { Link, usePathname, type Href } from 'expo-router';
import type { CSSProperties, ReactNode } from 'react';

import { useThemeMode } from '@/hooks/theme-mode';
import { primaryCtas, webNavigationCategories } from '@/lib/navigation';

type WebLinkProps = {
  href: string;
  prefetch?: boolean;
  className?: string;
  'aria-current'?: 'page';
  children: ReactNode;
};

function MenuLink({ href, prefetch, className, children, ...props }: WebLinkProps) {
  return (
    <Link asChild href={href as Href} prefetch={prefetch}>
      <a className={className} {...props}>
        {children}
      </a>
    </Link>
  );
}

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }

  return path || '/';
}

function isCurrentPath(currentPath: string, href: string) {
  const current = normalizePath(currentPath);
  const target = normalizePath(href);

  return current === target || (target !== '/' && current.startsWith(`${target}/`));
}

function CtaLink({
  href,
  label,
  variant = 'primary',
}: {
  href: Href;
  label: string;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Button asChild variant={variant === 'primary' ? 'default' : 'outline'} style={styles.ctaButton}>
      <Link href={href}>{label}</Link>
    </Button>
  );
}

export default function PublicIndexWebScreen() {
  const pathname = usePathname();
  const { activeTheme } = useThemeMode();

  return (
    <main className={activeTheme === 'dark' ? 'dark' : undefined} style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.headerCopy}>
            <span style={styles.eyebrow}>Moritz Brantner app shell</span>
            <h1 style={styles.title}>This repo now owns its screens, routes, and app flows.</h1>
            <p style={styles.description}>
              Navigation structure stays local to this Expo app, while reusable primitives still come from
              `@moritzbrantner/ui` where the sharing boundary actually makes sense.
            </p>
          </div>
          <div style={styles.navCard}>
            <NavigationMenu aria-label="Primary navigation" viewport={false} style={styles.navigationMenu}>
              <NavigationMenuList style={styles.navigationMenuList}>
                {webNavigationCategories.map((category) => (
                  <NavigationMenuItem key={category.key}>
                    <NavigationMenuTrigger aria-controls={`navigation-submenu-${category.key}`}>
                      {category.label}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent
                      id={`navigation-submenu-${category.key}`}
                      style={styles.navigationMenuContent}>
                      {category.items.map((item) => {
                        const active = isCurrentPath(pathname, item.href);

                        return (
                          <NavigationMenuLink
                            key={item.key}
                            asChild
                            active={active}
                            style={active ? styles.activeNavigationLink : undefined}>
                            <MenuLink
                              href={item.href}
                              prefetch={item.prefetch}
                              aria-current={active ? 'page' : undefined}>
                              <span>{item.label}</span>
                              {item.hotkey ? <Kbd>{item.hotkey}</Kbd> : null}
                            </MenuLink>
                          </NavigationMenuLink>
                        );
                      })}
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </header>

        <section style={styles.heroCard}>
          <div style={styles.heroCopy}>
            <Badge style={styles.badge}>Local ownership</Badge>
            <h2 style={styles.heroTitle}>One route map, authored here and reused across web and native.</h2>
            <p style={styles.heroDescription}>
              Expo Router still handles navigation, but the descriptor source now lives in this repository
              so product-specific flows can evolve without touching a shared shell package.
            </p>
          </div>
          <div style={styles.ctaRow}>
            <CtaLink href={primaryCtas[0].href} label={primaryCtas[0].label} />
            <CtaLink href={primaryCtas[1].href} label={primaryCtas[1].label} variant="secondary" />
          </div>
        </section>

        <section style={styles.grid}>
          <Card style={styles.panel}>
            <span style={styles.panelLabel}>Route ownership</span>
            <h3 style={styles.panelTitle}>Local native descriptors</h3>
            <p style={styles.panelText}>
              Tabs and stacks are sorted and registered from local descriptor helpers instead of an external
              frontend flow package.
            </p>
          </Card>

          <Card style={styles.panel}>
            <span style={styles.panelLabel}>Flow boundaries</span>
            <h3 style={styles.panelTitle}>Repo-owned screens</h3>
            <p style={styles.panelText}>
              Public auth, protected tabs, settings, and profile routes stay implemented here, which keeps
              screen behavior aligned with this app’s own backend contract.
            </p>
          </Card>

          <Card style={styles.panel}>
            <span style={styles.panelLabel}>Shared primitives</span>
            <h3 style={styles.panelTitle}>UI package stays reusable</h3>
            <p style={styles.panelText}>
              This landing page now composes generic `@moritzbrantner/ui` components directly, without
              outsourcing the application flow layer.
            </p>
          </Card>
        </section>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top left, color-mix(in oklch, var(--primary) 22%, transparent) 0%, transparent 28%), radial-gradient(circle at 84% 16%, color-mix(in oklch, var(--chart-2) 18%, transparent) 0%, transparent 24%), var(--background)',
    color: 'var(--foreground)',
  },
  shell: {
    width: 'min(1120px, calc(100vw - 40px))',
    margin: '0 auto',
    padding: '48px 0 72px',
  },
  header: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
    gap: '24px',
    alignItems: 'start',
  },
  headerCopy: {
    display: 'grid',
    gap: '16px',
  },
  eyebrow: {
    color: 'var(--primary)',
    fontSize: '0.82rem',
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(2.6rem, 6vw, 4.8rem)',
    lineHeight: 0.94,
    letterSpacing: '-0.06em',
    color: 'var(--foreground)',
  },
  description: {
    margin: 0,
    maxWidth: '62ch',
    fontSize: '1.05rem',
    lineHeight: 1.7,
    color: 'var(--muted-foreground)',
  },
  navCard: {
    padding: '18px',
    borderRadius: '24px',
    border: '1px solid var(--border)',
    background: 'var(--card)',
    backdropFilter: 'blur(16px)',
    boxShadow: 'var(--glass-shadow)',
  },
  navigationMenu: {
    width: '100%',
    justifyContent: 'flex-start',
  },
  navigationMenuList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'flex-start',
  },
  navigationMenuContent: {
    minWidth: '15rem',
  },
  activeNavigationLink: {
    background: 'color-mix(in oklch, var(--primary) 100%, transparent)',
    color: 'var(--primary-foreground)',
  },
  heroCard: {
    marginTop: '28px',
    padding: '28px',
    borderRadius: '26px',
    border: '1px solid var(--border)',
    background:
      'linear-gradient(135deg, color-mix(in oklch, var(--card) 92%, transparent), color-mix(in oklch, var(--popover) 96%, transparent))',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: '24px',
    alignItems: 'end',
  },
  heroCopy: {
    display: 'grid',
    gap: '12px',
  },
  badge: {
    width: 'fit-content',
    fontSize: '0.82rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  heroTitle: {
    margin: 0,
    fontSize: 'clamp(1.8rem, 3vw, 2.6rem)',
    lineHeight: 1,
    letterSpacing: '-0.04em',
  },
  heroDescription: {
    margin: 0,
    maxWidth: '56ch',
    lineHeight: 1.7,
    color: 'var(--muted-foreground)',
  },
  ctaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  ctaButton: {
    minWidth: '148px',
  },
  grid: {
    marginTop: '28px',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px',
    color: 'var(--foreground)',
  },
  panel: {
    display: 'grid',
    gap: '10px',
    padding: '22px',
    borderRadius: '24px',
  },
  panelLabel: {
    color: 'var(--primary)',
    fontSize: '0.76rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  panelTitle: {
    margin: 0,
    fontSize: '1.25rem',
    lineHeight: 1.1,
    letterSpacing: '-0.03em',
  },
  panelText: {
    margin: 0,
    lineHeight: 1.65,
    color: 'var(--muted-foreground)',
  },
};
