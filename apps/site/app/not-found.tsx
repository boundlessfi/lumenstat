import type { Metadata } from 'next';
import Link from 'next/link';
import { Mark } from '../components/icons';
import { copy, microcopy } from '../content/copy';
import styles from './not-found.module.css';

export const metadata: Metadata = {
  title: 'Page not found · Lumenstat',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main id="main" className={styles.page}>
      <Link href="/" className={styles.brand} aria-label={microcopy.homeLabel}>
        <Mark size={28} />
      </Link>
      <h1 className="h2">{copy.notFound.title}</h1>
      <p className="lead">{copy.notFound.text}</p>
      <Link href="/" className={styles.link}>
        {copy.notFound.link}
      </Link>
    </main>
  );
}
