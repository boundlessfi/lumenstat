import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import {
  Api,
  Checks,
  Enrollment,
  Faq,
  FinalCta,
  Hero,
  Infrastructure,
  Operators,
  Privacy,
  Tracker,
} from '../components/Sections';
import { copy } from '../content/copy';

export default function Page() {
  return (
    <>
      <Header copy={copy} />
      <main id="main" tabIndex={-1}>
        <Hero copy={copy} />
        <Checks copy={copy} />
        <Privacy copy={copy} />
        <Api copy={copy} />
        <Tracker copy={copy} />
        {/* Enrollment comes before the operator section on purpose: projects are the main conversion. */}
        <Enrollment copy={copy} />
        <Operators copy={copy} />
        <Infrastructure copy={copy} />
        <Faq copy={copy} />
        <FinalCta copy={copy} />
      </main>
      <Footer copy={copy} />
    </>
  );
}
