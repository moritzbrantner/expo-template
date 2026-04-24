import '@/styles/frontend-ui-web.css';

import { GroupedNavigationMenu } from '@moritzbrantner/frontend-ui/web';
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
    <Link asChild href={href}>
      <a
        style={{
          ...styles.cta,
          ...(variant === 'primary' ? styles.primaryCta : styles.secondaryCta),
        }}>
        {label}
      </a>
    </Link>
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
            <h1 style={styles.title}>Shared navigation is now wired through `@moritzbrantner/frontend-ui`.</h1>
            <p style={styles.description}>
              The web landing surface now uses the shared grouped navigation menu, while native tabs and
              stacks are driven from the same descriptor source instead of hardcoded screen registrations.
            </p>
          </div>
          <div style={styles.navCard}>
            <GroupedNavigationMenu
              categories={webNavigationCategories}
              currentPath={pathname}
              LinkComponent={MenuLink}
            />
          </div>
        </header>

        <section style={styles.heroCard}>
          <div style={styles.heroCopy}>
            <span style={styles.badge}>Integration pass</span>
            <h2 style={styles.heroTitle}>One route map, shared across web and native.</h2>
            <p style={styles.heroDescription}>
              The app keeps Expo Router in charge of navigation, but the ordering, labels, and exposed
              entrypoints now come from the shared package where it actually has reusable surface area.
            </p>
          </div>
          <div style={styles.ctaRow}>
            <CtaLink href={primaryCtas[0].href} label={primaryCtas[0].label} />
            <CtaLink href={primaryCtas[1].href} label={primaryCtas[1].label} variant="secondary" />
          </div>
        </section>

        <section style={styles.grid}>
          <article style={styles.panel}>
            <span style={styles.panelLabel}>Shared sources</span>
            <h3 style={styles.panelTitle}>Native tab descriptors</h3>
            <p style={styles.panelText}>
              `createNativeTabDescriptors` now drives the Expo tabs, including route order, titles, and
              icon metadata.
            </p>
          </article>

          <article style={styles.panel}>
            <span style={styles.panelLabel}>Shared sources</span>
            <h3 style={styles.panelTitle}>Stack descriptors</h3>
            <p style={styles.panelText}>
              Public and protected stack registration now runs from the same descriptor config instead of
              separate hardcoded layouts.
            </p>
          </article>

          <article style={styles.panel}>
            <span style={styles.panelLabel}>Web surface</span>
            <h3 style={styles.panelTitle}>Grouped navigation menu</h3>
            <p style={styles.panelText}>
              The landing page bridges Expo Router links into `GroupedNavigationMenu`, so the shared web
              shell is used where it fits this repo today.
            </p>
          </article>
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
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    padding: '6px 12px',
    borderRadius: '999px',
    background: 'var(--accent)',
    color: 'var(--accent-foreground)',
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
  cta: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '48px',
    padding: '0 18px',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    textDecoration: 'none',
    fontWeight: 700,
    boxShadow: 'var(--glass-raised-shadow)',
    backdropFilter: 'blur(14px)',
  },
  primaryCta: {
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
  },
  secondaryCta: {
    background: 'var(--secondary)',
    color: 'var(--secondary-foreground)',
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
    background: 'var(--card)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--glass-shadow)',
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
