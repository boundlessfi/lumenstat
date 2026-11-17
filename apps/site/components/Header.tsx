import { microcopy, type Copy } from '../content/copy';
import { site } from '../site.config';
import { GitHubIcon, Mark } from './icons';
import { MobileMenu } from './MobileMenu';
import { Button } from './ui';
import styles from './Header.module.css';

export function Header({ copy }: { copy: Copy }) {
  const links = (
    <>
      {copy.nav.map(item => (
        <li key={item.href}>
          <a href={item.href}>{item.label}</a>
        </li>
      ))}
      {site.docsUrl ? (
        <li>
          <a href={site.docsUrl} target="_blank" rel="noopener" data-umami-event="outbound-docs">
            {copy.docs}
          </a>
        </li>
      ) : null}
    </>
  );

  const repoLink = (className: string | undefined, visibleLabel: boolean) =>
    site.repoPublic ? (
      <a href={site.repoUrl} className={className} target="_blank" rel="noopener" data-umami-event="outbound-github">
        <GitHubIcon width={18} height={18} />
        <span className={visibleLabel ? undefined : 'vh'}>{copy.footer.github}</span>
        <span className="vh"> {microcopy.opensGitHub}</span>
      </a>
    ) : null;

  return (
    <header id="site-header" className={styles.header}>
      <div className={`container ${styles.bar}`}>
        <a href="#top" className={styles.brand} aria-label={microcopy.homeLabel}>
          <Mark size={24} />
          <span className={styles.wordmark}>Lumenstat</span>
        </a>

        <nav aria-label="Main" className={styles.nav}>
          <ul>{links}</ul>
        </nav>

        <div className={styles.actions}>
          {repoLink(styles.repo, false)}
          <a href={site.signinUrl} className={styles.signin}>
            {copy.signIn}
            <span className="vh"> {microcopy.opensApp}</span>
          </a>
          <Button href={site.signupUrl} event="cta-enroll-nav" opens={microcopy.opensApp} arrow={false} className={styles.cta}>
            {copy.enroll}
          </Button>
          <MobileMenu>
            <nav aria-label="Menu">
              <ul>
                {links}
                {site.repoPublic ? <li>{repoLink(styles.menuRepo, true)}</li> : null}
                <li>
                  <a href={site.signinUrl}>
                    {copy.signIn}
                    <span className="vh"> {microcopy.opensApp}</span>
                  </a>
                </li>
              </ul>
            </nav>
            <Button href={site.signupUrl} event="cta-enroll-nav" opens={microcopy.opensApp} className={styles.menuCta}>
              {copy.enroll}
            </Button>
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
