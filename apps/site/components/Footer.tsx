import { microcopy, type Copy } from '../content/copy';
import { site } from '../site.config';
import { Mark } from './icons';
import styles from './Footer.module.css';

type FooterLink = { label: string; href: string; event?: string; external?: boolean; opens?: string };

export function Footer({ copy }: { copy: Copy }) {
  const f = copy.footer;

  const product: FooterLink[] = [
    ...copy.nav.filter(item => item.href !== '#faq'),
    { label: copy.signIn, href: site.signinUrl, opens: microcopy.opensApp },
  ];

  const project: FooterLink[] = [
    ...(site.repoPublic
      ? [
          { label: f.github, href: site.repoUrl, event: 'outbound-github', external: true, opens: microcopy.opensGitHub },
          {
            label: f.security,
            href: `${site.repoUrl}/security/policy`,
            event: 'outbound-github',
            external: true,
            opens: microcopy.opensGitHub,
          },
        ]
      : []),
    ...(site.docsUrl ? [{ label: copy.docs, href: site.docsUrl, event: 'outbound-docs', external: true }] : []),
    ...(site.publicStatsUrl ? [{ label: f.publicStats, href: site.publicStatsUrl }] : []),
  ];

  const column = (heading: string, links: FooterLink[]) =>
    links.length ? (
      <div>
        <p className={`label ${styles.heading}`}>{heading}</p>
        <ul className={styles.links}>
          {links.map(link => (
            <li key={link.label}>
              <a
                href={link.href}
                data-umami-event={link.event}
                {...(link.external ? { target: '_blank', rel: 'noopener' } : {})}
              >
                {link.label}
                {link.opens ? <span className="vh"> {link.opens}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.about}>
          <p className={styles.brand}>
            <Mark size={24} />
            <span className={styles.wordmark}>Lumenstat</span>
          </p>
          <p className={styles.tagline}>{f.tagline}</p>
          <p className="small">
            {f.builtBy}{' '}
            <a href={site.builtBy.url} rel="noopener">
              {site.builtBy.name}
            </a>
          </p>
        </div>

        {column(f.productHeading, product)}
        {column(f.projectHeading, project)}

        <div className={styles.site}>
          <p className={`label ${styles.heading}`}>{f.aboutHeading}</p>
          <p className="small">{f.about}</p>
        </div>
      </div>

      <div className={`container ${styles.legal}`}>
        <p className="small">{f.trademark}</p>
        <p className="small">
          © {new Date().getFullYear()} {site.legalEntity}.
        </p>
      </div>
    </footer>
  );
}
